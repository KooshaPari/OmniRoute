import { connect, type Socket } from 'node:net';
import { decodeMessage, encodeMessage, type KbridgeRequest, type KbridgeResponse } from './protocol';
import { buildKbridgeRequest, type KbridgeOpParams } from './call';

/**
 * Transport decision (#392):
 * - *nix: Unix domain socket path (default `/var/run/argismonitor/gateway.sock`)
 * - Windows: named pipe via the same `net.connect(path)` API, e.g.
 *   `\\.\pipe\omniroute-gateway` (set `OMNIROUTE_GATEWAY_SOCKET`)
 * TCP loopback is not the production transport.
 */
const DEFAULT_UNIX_SOCKET = '/var/run/argismonitor/gateway.sock';
const DEFAULT_WIN_PIPE = '\\\\.\\pipe\\omniroute-gateway';
const DEFAULT_TIMEOUT_MS = 5_000;

export type KbridgeClientOptions = {
  socketPath?: string;
  timeoutMs?: number;
  connect?: (path: string) => Socket;
};

type InflightEntry = {
  resolve: (r: KbridgeResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function resolveGatewaySocketPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const configured =
    env.OMNIROUTE_GATEWAY_SOCKET ??
    env.OMNIRoute_GATEWAY_SOCKET ?? // legacy casing
    '';
  if (configured.trim()) return configured.trim();
  return platform === 'win32' ? DEFAULT_WIN_PIPE : DEFAULT_UNIX_SOCKET;
}

export function createKbridgeClient(options: KbridgeClientOptions = {}) {
  const socketPath = options.socketPath ?? resolveGatewaySocketPath();
  const timeoutMs = options.timeoutMs ?? Number(process.env.KBRIDGE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const connectFn = options.connect ?? ((path: string) => connect(path));

  let socket: Socket | null = null;
  const inflight = new Map<string, InflightEntry>();

  function failAll(err: Error) {
    for (const [, entry] of inflight) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    inflight.clear();
  }

  function connectSocket(): Socket {
    if (socket && !socket.destroyed) return socket;
    const s = connectFn(socketPath);
    socket = s;
    let buf = Buffer.alloc(0);
    s.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4) {
        const len = buf.readUInt32BE(0);
        if (buf.length < 4 + len) break;
        const msgBuf = buf.subarray(4, 4 + len);
        buf = buf.subarray(4 + len);
        try {
          const reply = decodeMessage(msgBuf);
          if ('ok' in reply) {
            const entry = inflight.get(reply.id);
            if (entry) {
              clearTimeout(entry.timer);
              inflight.delete(reply.id);
              entry.resolve(reply);
            }
          }
        } catch (e) {
          console.error('[kbridge] decode error', e);
        }
      }
    });
    s.on('error', (err) => {
      console.error('[kbridge] socket error', err);
      failAll(err instanceof Error ? err : new Error(String(err)));
      socket = null;
    });
    s.on('close', () => {
      socket = null;
    });
    return s;
  }

  async function call<Op extends KbridgeRequest['op']>(
    op: Op,
    params: KbridgeOpParams[Op],
    signal?: AbortSignal,
  ): Promise<KbridgeResponse> {
    if (signal?.aborted) {
      throw new Error('kbridge call aborted');
    }

    const id = crypto.randomUUID();
    const partial = buildKbridgeRequest(op, params);
    const message: KbridgeRequest = { ...partial, id };
    const payload = encodeMessage(message);
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32BE(payload.length, 0);
    payload.copy(frame, 4);

    const s = connectSocket();

    const responsePromise = new Promise<KbridgeResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        inflight.delete(id);
        reject(new Error(`kbridge call timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Register BEFORE write so a fast reply cannot race past the waiter (#392).
      inflight.set(id, { resolve, reject, timer });

      if (signal) {
        const onAbort = () => {
          const entry = inflight.get(id);
          if (!entry) return;
          clearTimeout(entry.timer);
          inflight.delete(id);
          entry.reject(new Error('kbridge call aborted'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });

    await new Promise<void>((resolve, reject) => {
      s.write(frame, (err) => {
        if (err) {
          const entry = inflight.get(id);
          if (entry) {
            clearTimeout(entry.timer);
            inflight.delete(id);
          }
          reject(err);
          return;
        }
        resolve();
      });
    });

    return responsePromise;
  }

  return {
    socketPath,
    timeoutMs,
    /** Test seam: current inflight map size. */
    inflightSize: () => inflight.size,
    ping: (signal?: AbortSignal) => call('ping', {} as KbridgeOpParams['ping'], signal),
    health: (signal?: AbortSignal) => call('health', {} as KbridgeOpParams['health'], signal),
    resolveCombo: (name: string, model: string, signal?: AbortSignal) =>
      call('combo.resolve', { name, model }, signal),
    recordUsage: (
      provider: string,
      model: string,
      tokens: number,
      cost: number,
      signal?: AbortSignal,
    ) => call('usage.record', { provider, model, tokens, cost }, signal),
  };
}

const defaultClient = createKbridgeClient();

export const kbridge = {
  ping: defaultClient.ping,
  health: defaultClient.health,
  resolveCombo: defaultClient.resolveCombo,
  recordUsage: defaultClient.recordUsage,
};

export function kbridgeAvailable(): boolean {
  return Boolean(
    process.env.OMNIROUTE_GATEWAY_SOCKET?.trim() ||
      process.env.OMNIRoute_GATEWAY_SOCKET?.trim(),
  );
}
