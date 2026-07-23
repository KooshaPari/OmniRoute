import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import { decodeMessage, encodeMessage, type KbridgeResponse } from './protocol';
import { createKbridgeClient, resolveGatewaySocketPath } from './client';

class FakeSocket extends EventEmitter {
  destroyed = false;
  written: Buffer[] = [];

  write(frame: Buffer, cb?: (err?: Error | null) => void): boolean {
    this.written.push(frame);
    queueMicrotask(() => cb?.(null));
    return true;
  }

  reply(response: KbridgeResponse) {
    const payload = encodeMessage(response);
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32BE(payload.length, 0);
    payload.copy(frame, 4);
    this.emit('data', frame);
  }
}

describe('resolveGatewaySocketPath', () => {
  it('prefers configured OMNIROUTE_GATEWAY_SOCKET', () => {
    expect(
      resolveGatewaySocketPath({ OMNIROUTE_GATEWAY_SOCKET: '\\\\.\\pipe\\custom' }, 'win32'),
    ).toBe('\\\\.\\pipe\\custom');
  });

  it('defaults to named pipe on Windows and unix socket elsewhere', () => {
    expect(resolveGatewaySocketPath({}, 'win32')).toBe('\\\\.\\pipe\\omniroute-gateway');
    expect(resolveGatewaySocketPath({}, 'linux')).toBe('/var/run/argismonitor/gateway.sock');
  });
});

describe('kbridge call lifecycle', () => {
  it('registers inflight before write completes so a fast reply cannot race', async () => {
    const fake = new FakeSocket();
    const client = createKbridgeClient({
      socketPath: '\\\\.\\pipe\\test',
      timeoutMs: 1000,
      connect: () => fake as unknown as import('node:net').Socket,
    });

    const originalWrite = fake.write.bind(fake);
    fake.write = ((frame: Buffer, cb?: (err?: Error | null) => void) => {
      const idLen = frame.readUInt32BE(0);
      const msg = frame.subarray(4, 4 + idLen);
      const decoded = decodeMessage(msg) as { id: string };
      expect(client.inflightSize()).toBe(1);
      fake.reply({ id: decoded.id, ok: true, data: { pong: true } });
      return originalWrite(frame, cb);
    }) as typeof fake.write;

    const reply = await client.ping();
    expect(reply).toEqual({ id: expect.any(String), ok: true, data: { pong: true } });
    expect(client.inflightSize()).toBe(0);
  });

  it('rejects on deadline when no response arrives', async () => {
    const fake = new FakeSocket();
    fake.write = ((_frame: Buffer, cb?: (err?: Error | null) => void) => {
      queueMicrotask(() => cb?.(null));
      return true;
    }) as typeof fake.write;

    const client = createKbridgeClient({
      socketPath: '/tmp/test.sock',
      timeoutMs: 30,
      connect: () => fake as unknown as import('node:net').Socket,
    });

    await expect(client.ping()).rejects.toThrow(/timed out/i);
    expect(client.inflightSize()).toBe(0);
  });

  it('honors AbortSignal cancellation', async () => {
    const fake = new FakeSocket();
    fake.write = ((_frame: Buffer, cb?: (err?: Error | null) => void) => {
      queueMicrotask(() => cb?.(null));
      return true;
    }) as typeof fake.write;

    const client = createKbridgeClient({
      socketPath: '/tmp/test.sock',
      timeoutMs: 5_000,
      connect: () => fake as unknown as import('node:net').Socket,
    });

    const controller = new AbortController();
    const pending = client.ping(controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow(/aborted/i);
    expect(client.inflightSize()).toBe(0);
  });
});
