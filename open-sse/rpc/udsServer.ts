/**
 * T2 — Unix-domain-socket RPC server for polyglot edges (ADR-032 / F1).
 *
 * The server-side complement to `udsClient.ts`. Listens on a UDS socket,
 * dispatches incoming JSON-RPC frames to registered handlers, and writes
 * framed responses. One handler per (method, schema) pair; the registration
 * is type-safe via a generic key.
 *
 * Lifecycle:
 *   - Singleton (`getPolyglotUdsServer`) ensures only one server per process.
 *   - `start()` binds the UDS socket (lazy on first `register`).
 *   - `stop()` unlinks the socket and closes connections.
 *   - On graceful shutdown (SIGTERM, SIGINT), the server stops cleanly.
 *
 * Auth model:
 *   - UDS inherits filesystem permissions (0600 by default). Adequate for
 *     same-host processes within the OmniRoute monorepo.
 *   - `OMNIROUTE_UDS_REQUIRE_AUTH=1` enables a per-connection challenge
 *     handshake using a shared secret in `OMNIROUTE_UDS_SHARED_SECRET`.
 *   - Cross-host RPC must use T1 HTTP (with mTLS), per ADR-032 §"Why T2".
 *
 * Tight inner-loop edges (T3) should use FFI directly, not this server.
 */

import { existsSync, mkdirSync, unlinkSync, chmodSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { dirname } from "node:path";
import type { PolyglotEdgeError } from "./errors.ts";

const UDS_DEFAULT = () =>
  process.env.OMNIROUTE_UDS_SOCKET ?? `${process.env.DATA_DIR ?? "~/.omniroute"}/polyglot.sock`;

type Handler<Params = unknown, Result = unknown> = (params: Params) => Promise<Result> | Result;

interface UdsServerState {
  socketPath: string;
  server: Server | null;
  handlers: Map<string, Handler<unknown, unknown>>;
  isListening: boolean;
}

let singleton: UdsServerState | null = null;
let startingPromise: Promise<void> | null = null;

function getOrCreateServer(socketPath: string): UdsServerState {
  if (singleton && singleton.socketPath === socketPath) return singleton;
  if (singleton && singleton.socketPath !== socketPath) {
    throw new Error(
      `Polyglot UDS server already bound to ${singleton.socketPath}; cannot rebind to ${socketPath}`
    );
  }
  singleton = {
    socketPath,
    server: null,
    handlers: new Map(),
    isListening: false,
  };
  return singleton;
}

export function registerUdsHandler<TParams, TResult>(
  method: string,
  handler: Handler<TParams, TResult>
): void {
  const state = getOrCreateServer(UDS_DEFAULT());
  state.handlers.set(method, handler as Handler<unknown, unknown>);
  // Don't bind the socket until something actually registers — saves
  // cleanup when only T1/T3 edges are active.
  if (!state.isListening && !startingPromise) {
    startingPromise = startServer(state).catch((error) => {
      // Reset so a retry is possible.
      startingPromise = null;
      // eslint-disable-next-line no-console
      console.error(`[polyglot/uds] failed to start: ${error.message}`);
    });
  }
}

export async function start(): Promise<void> {
  const state = getOrCreateServer(UDS_DEFAULT());
  if (state.isListening) return;
  if (startingPromise) {
    await startingPromise;
    return;
  }
  startingPromise = startServer(state);
  await startingPromise;
}

export async function stop(): Promise<void> {
  const state = singleton;
  if (!state || !state.server) return;

  state.server.close();
  await new Promise<void>((resolve) => {
    state.server!.close(() => resolve());
  });
  try {
    unlinkSync(state.socketPath);
  } catch {
    // Socket may already be unlinked (cleanup race).
  }
  state.server = null;
  state.isListening = false;
  startingPromise = null;
}

async function startServer(state: UdsServerState): Promise<void> {
  await ensureSocketDir(state.socketPath);

  // Unlink any pre-existing socket file (prevents EADDRINUSE).
  if (existsSync(state.socketPath)) {
    try {
      unlinkSync(state.socketPath);
    } catch (error) {
      throw new Error(
        `Cannot unlink stale UDS socket at ${state.socketPath}: ${(error as Error).message}`
      );
    }
  }

  const server = createServer({ allowHalfOpen: false }, (socket) => handleConnection(state, socket));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(state.socketPath, () => {
      server.off("error", reject);
      try {
        chmodSync(state.socketPath, 0o660);
      } catch {
        // Non-fatal on filesystems that don't support chmod (e.g. Windows).
      }
      resolve();
    });
  });

  state.server = server;
  state.isListening = true;
}

async function ensureSocketDir(socketPath: string): Promise<void> {
  const dir = dirname(socketPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

interface ConnectionState {
  buffer: string;
  authenticated: boolean;
}

function handleConnection(state: UdsServerState, socket: Socket): void {
  const connState: ConnectionState = { buffer: "", authenticated: false };
  socket.setNoDelay(true);

  socket.on("data", (chunk) => {
    connState.buffer += chunk.toString("utf-8");
    let newlineIdx;
    while ((newlineIdx = connState.buffer.indexOf("\n")) >= 0) {
      const line = connState.buffer.slice(0, newlineIdx);
      connState.buffer = connState.buffer.slice(newlineIdx + 1);
      if (!line.trim()) continue;
      handleFrame(state, socket, connState, line);
    }
  });

  socket.on("close", () => {
    socket.removeAllListeners();
  });

  socket.on("error", () => {
    // Silently drop connections; reconnect logic is on the client side.
  });
}

async function handleFrame(
  state: UdsServerState,
  socket: Socket,
  connState: ConnectionState,
  frame: string
): Promise<void> {
  let request: { jsonrpc?: string; id?: number; method?: string; params?: unknown };
  try {
    request = JSON.parse(frame);
  } catch {
    writeError(socket, null, -32700, "Parse error");
    return;
  }

  if (request.jsonrpc !== "2.0") {
    writeError(socket, request.id ?? null, -32600, "Invalid Request");
    return;
  }

  const method = request.method;
  if (typeof method !== "string") {
    writeError(socket, request.id ?? null, -32600, "Method missing");
    return;
  }

  // Auth gate (opt-in via env).
  if (process.env.OMNIROUTE_UDS_REQUIRE_AUTH === "1") {
    if (!connState.authenticated) {
      const required = process.env.OMNIROUTE_UDS_SHARED_SECRET;
      if (!required) {
        writeError(socket, request.id ?? null, -32001, "Server auth misconfigured");
        return;
      }
      // Treat the first frame as a handshake; subsequent frames must reuse
      // the same socket.
      if (typeof request.params !== "object" || (request.params as { handshake?: string })?.handshake !== required) {
        writeError(socket, request.id ?? null, -32002, "Auth required");
        return;
      }
      connState.authenticated = true;
      writeResult(socket, request.id ?? null, { ok: true, auth: "accepted" });
      return;
    }
  }

  const handler = state.handlers.get(method);
  if (!handler) {
    writeError(socket, request.id ?? null, -32601, `Method not found: ${method}`);
    return;
  }

  try {
    const result = await handler(request.params);
    writeResult(socket, request.id ?? null, result);
  } catch (error) {
    const err: PolyglotEdgeError = new Error(error instanceof Error ? error.message : String(error));
    err.code = "HANDLER_ERROR";
    writeError(socket, request.id ?? null, -32000, err.message);
  }
}

function writeResult(socket: Socket, id: number | null, result: unknown): void {
  if (id === null) return; // Notification — no response.
  socket.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`, "utf-8");
}

function writeError(socket: Socket, id: number | null, code: number, message: string): void {
  socket.write(
    `${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`,
    "utf-8"
  );
}

/**
 * Run a handler in-process without binding a real UDS socket. Useful for
 * tests and for same-process consumers (e.g. when the UDS server is the
 * host's own Next.js process and there's nothing to cross).
 */
export function callHandlerInProcess<TParams, TResult>(
  method: string,
  params: TParams
): Promise<TResult> {
  const state = singleton;
  if (!state) {
    return Promise.reject(new Error("Polyglot UDS server not initialized"));
  }
  const handler = state.handlers.get(method);
  if (!handler) {
    return Promise.reject(new Error(`Method not registered: ${method}`));
  }
  return Promise.resolve(handler(params));
}

export function getPolyglotUdsServer(): UdsServerState | null {
  return singleton;
}
