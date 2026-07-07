/**
 * /api/kbridge — WebSocket bridge from browser to the BFF, which forwards
 * msgpack frames to the omniroute-server Unix socket at /var/run/omniroute/gateway.sock.
 */
import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/cloudflare-workers';
import { KbridgeRequest, KbridgeResponse, AppError } from '@omniroute/shared-types';
import { connect } from 'node:net';
import { encode, decode } from 'msgpackr';
import { config } from '../../env';

const SOCKET = config.KBRIDGE_SOCKET;

export const kbridgeRoute = new Hono()
  .get('/', upgradeWebSocket(() => ({
    async onMessage(_evt, ws) {
      try {
        const req = KbridgeRequest.parse(JSON.parse(String(_evt.data)));
        const reply = await callKbridge(req);
        ws.send(JSON.stringify(reply));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'parse error';
        const err: AppError = { code: 'VALIDATION_ERROR', message: msg, issues: [{ path: 'kbridge', message: msg }] };
        ws.send(JSON.stringify({ id: '?', ok: false, error: { code: err.code, message: err.message } } satisfies KbridgeResponse));
      }
    },
  })));

export async function callKbridge(req: KbridgeRequest): Promise<KbridgeResponse> {
  return new Promise((resolve, reject) => {
    const sock = connect(SOCKET);
    let buf = Buffer.alloc(0);
    const payload = encode(req);
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32BE(payload.length, 0);
    payload.copy(frame, 4);
    sock.on('connect', () => sock.write(frame));
    sock.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4) {
        const len = buf.readUInt32BE(0);
        if (buf.length < 4 + len) break;
        const body = buf.subarray(4, 4 + len);
        buf = buf.subarray(4 + len);
        try {
          const reply = KbridgeResponse.parse(decode(body));
          sock.end();
          resolve(reply);
          return;
        } catch (e) {
          sock.destroy();
          reject(e as Error);
        }
      }
    });
    sock.on('error', (err) => reject(err));
    sock.setTimeout(5_000, () => { sock.destroy(); reject(new Error('kbridge timeout')); });
  });
}
