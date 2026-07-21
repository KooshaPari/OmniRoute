/**
 * T2 — Unix-domain-socket RPC transport for dispatch edges (ADR-032 / F1).
 *
 * Implements a JSON-RPC 2.0 framed-over-UDS protocol. This is intentionally
 * the simplest battle-tested RPC format (no Protobuf compilation step, no
 * Cap'n Proto runtime) — easy to migrate to Cap'n Proto or FlatBuffers
 * later as a wire-format swap (zero call-site change thanks to
 * `dispatchEdges.ts`).
 *
 * Wire format (line-delimited JSON-RPC):
 *   → request:  `{"jsonrpc":"2.0","id":<u64>,"method":"<name>","params":<obj>}\n`
 *   ← response: `{"jsonrpc":"2.0","id":<u64>,"result":<obj>|"error":{...}}\n`
 *
 * Socket discovery:
 *   - `OMNIROUTE_UDS_SOCKET` env override (canonical cross-process coord).
 *   - Default: `${DATA_DIR}/dispatch.sock` (DATA_DIR defaults to ~/.omniroute/).
 *   - Per-edge contract `.socket` field overrides.
 *
 * Connection pooling:
 *   - One persistent connection per process; all edges multiplex over it
 *     via u64 request IDs (JSON-RPC standard).
 *   - Reconciles on socket failure (auto-reconnects with backoff).
 *   - Falls back to throwing on `invokeUdsEdge` if the server is missing —
 *     callers (the dispatch resolver) then degrade to T1.
 */

import { existsSync } from "node:fs";
import { connect, type Socket } from "node:net";
import type { UdsEdgeContract, InvokeOptions } from "./dispatchEdges.ts";
import type { DispatchEdgeError } from "./errors.ts";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const UDS_DEFAULT = () =>
  process.env.OMNIROUTE_UDS_SOCKET ?? `${process.env.DATA_DIR ?? "~/.omniroute"}/dispatch.sock`;

interface UdsClientState {
  socket: Socket | null;
  buffer: string;
  pending: Map<number, PendingRequest>;
  nextId: number;
  reconnectAttempts: number;
  destroyed: boolean;
}

const clientsBySocket = new Map<string, UdsClientState>();

function getOrCreateClient(socketPath: string): UdsClientState {
  let state = clientsBySocket.get(socketPath);
  if (state) return state;

  state = {
    socket: null,
    buffer: "",
    pending: new Map(),
    nextId: 1,
    reconnectAttempts: 0,
    destroyed: false,
  };
  clientsBySocket.set(socketPath, state);
  scheduleConnect(state, socketPath);
  return state;
}

function scheduleConnect(state: UdsClientState, socketPath: string): void {
  if (state.destroyed) return;
  if (state.reconnectAttempts > 5) {
    return; // Give up; future invokes will fail and the resolver will downgrade.
  }

  if (!existsSync(socketPath)) {
    // Backoff exponentially up to 1s; gives the server time to bind.
    const delay = Math.min(1000, 50 * Math.pow(2, state.reconnectAttempts));
    state.reconnectAttempts++;
    setTimeout(() => scheduleConnect(state, socketPath), delay);
    return;
  }

  const socket = connect(socketPath);
  state.socket = socket;
  state.buffer = "";
  state.reconnectAttempts = 0;

  socket.setNoDelay(true);

  socket.on("data", (chunk) => handleSocketData(state, socketPath, chunk.toString("utf-8")));
  socket.on("close", () => handleSocketClose(state, socketPath));
  socket.on("error", (error) => handleSocketError(state, socketPath, error));
}

function handleSocketData(state: UdsClientState, socketPath: string, chunk: string): void {
  state.buffer += chunk;
  let newlineIdx;
  while ((newlineIdx = state.buffer.indexOf("\n")) >= 0) {
    const line = state.buffer.slice(0, newlineIdx);
    state.buffer = state.buffer.slice(newlineIdx + 1);
    if (!line.trim()) continue;

    let msg: { id?: number; result?: unknown; error?: { code?: number; message?: string } };
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // Drop malformed frames.
    }
    if (typeof msg.id !== "number") continue;
    const pending = state.pending.get(msg.id);
    if (!pending) continue;
    state.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error) {
      const err: DispatchEdgeError = new Error(msg.error.message ?? "UDS RPC error");
      err.code = `UDS_${msg.error.code ?? "ERROR"}`;
      pending.reject(err);
    } else {
      pending.resolve(msg.result);
    }
  }
}

function handleSocketClose(state: UdsClientState, socketPath: string): void {
  // Reject any pending requests with a transport error.
  for (const [id, pending] of state.pending.entries()) {
    clearTimeout(pending.timer);
    const err: DispatchEdgeError = new Error("UDS socket closed before response");
    err.code = "UDS_CLOSED";
    pending.reject(err);
    state.pending.delete(id);
  }
  state.socket = null;
  if (!state.destroyed) {
    state.reconnectAttempts++;
    scheduleConnect(state, socketPath);
  }
}

function handleSocketError(state: UdsClientState, socketPath: string, error: Error): void {
  // ECONNREFUSED is the typical boot-race condition; nudge reconnect.
  if (error.message.includes("ECONNREFUSED")) {
    state.reconnectAttempts++;
    scheduleConnect(state, socketPath);
  }
}

export async function invokeUdsEdge<TIn, TOut>(
  contract: UdsEdgeContract<TIn, TOut>,
  input: TIn,
  options: InvokeOptions = {}
): Promise<TOut> {
  const socketPath = contract.socket ?? UDS_DEFAULT();
  const timeoutMs = options.timeoutMs ?? contract.timeoutMs ?? 1000;
  const state = getOrCreateClient(socketPath);

  if (!state.socket) {
    throw createUdsTransportError("UDS socket not connected", socketPath);
  }

  const id = state.nextId++;
  const request = `${JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: contract.method,
    params: input,
  })}\n`;

  return new Promise<TOut>((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      const err: DispatchEdgeError = new Error(`UDS RPC ${contract.method} timed out after ${timeoutMs}ms`);
      err.code = "UDS_TIMEOUT";
      reject(err);
    }, timeoutMs);

    state.pending.set(id, {
      resolve: (value) => resolve(value as TOut),
      reject,
      timer,
    });

    state.socket!.write(request, "utf-8", (error) => {
      if (error) {
        clearTimeout(timer);
        state.pending.delete(id);
        const err: DispatchEdgeError = new Error(`UDS RPC write failed: ${error.message}`);
        err.code = "UDS_WRITE_ERROR";
        reject(err);
      }
    });
  });
}

function createUdsTransportError(message: string, socketPath: string): DispatchEdgeError {
  const err: DispatchEdgeError = new Error(`${message} (socket=${socketPath})`);
  err.code = "UDS_NO_CONNECTION";
  return err;
}

/**
 * Smoke-test a UDS RPC edge. Returns null if the server is reachable.
 */
export async function healthcheckUdsEdge(contract: UdsEdgeContract<unknown, unknown>): Promise<string | null> {
  const socketPath = contract.socket ?? UDS_DEFAULT();
  try {
    await invokeUdsEdge(contract, { healthcheck: true } as never, { timeoutMs: 250 });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Disconnect all pooled UDS clients. Test-only.
 */
export function __disconnectAllUdsClientsForTests(): void {
  for (const state of clientsBySocket.values()) {
    state.destroyed = true;
    state.socket?.destroy();
    for (const pending of state.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("UDS client destroyed"));
    }
    state.pending.clear();
  }
  clientsBySocket.clear();
}
