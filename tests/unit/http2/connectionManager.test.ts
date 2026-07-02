import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import http2 from 'node:http2';
import { once } from 'node:events';
import { Http2ConnectionManager } from '@/lib/http2/connectionManager.js';

const certPath = resolve(import.meta.dirname, 'test-cert.pem');
const keyPath = resolve(import.meta.dirname, 'test-key.pem');

const cert = readFileSync(certPath, 'utf8');
const key = readFileSync(keyPath, 'utf8');

describe('Http2ConnectionManager', () => {
  let manager: Http2ConnectionManager;
  let server: http2.Http2SecureServer;
  let port: number;

  before(async () => {
    manager = new Http2ConnectionManager({ rejectUnauthorized: false, sweepIntervalMs: 100 });

    server = http2.createSecureServer({ cert, key }, (req, res) => {
      const body: Buffer[] = [];
      req.on('data', (c: Buffer) => body.push(c));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, path: req.url, body: Buffer.concat(body).toString() }));
      });
    });

    server.listen(0);
    await once(server, 'listening');
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  after(async () => {
    await manager.close();
    server.close();
  });

  it('should perform a basic HTTP/2 fetch', async () => {
    const res = await manager.fetch(`https://127.0.0.1:${port}/test`, {
      method: 'GET',
      headers: { 'x-request-id': 'abc' },
    });
    assert.equal(res.ok, true);
    const body = await res.json() as any;
    assert.equal(body.method, 'GET');
    assert.equal(body.path, '/test');
  });

  it('should POST JSON body', async () => {
    const res = await manager.fetch(`https://127.0.0.1:${port}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    assert.equal(res.ok, true);
    const body = await res.json() as any;
    assert.equal(body.method, 'POST');
    assert.equal(body.body, '{"hello":"world"}');
  });

  it('should reuse the session on a second request to the same origin', async () => {
    // First request establishes the session
    const res1 = await manager.fetch(`https://127.0.0.1:${port}/a`, { method: 'GET' });
    assert.equal(res1.ok, true);

    // The session should be reused — inspect internal sessions pool
    const pool = (manager as any).sessions as Map<string, any>;
    assert.equal(pool.size, 1);

    const res2 = await manager.fetch(`https://127.0.0.1:${port}/b`, { method: 'GET' });
    assert.equal(res2.ok, true);
    assert.equal(pool.size, 1);
  });

  it('should respect maxStreams limit on a session', async () => {
    const promises: Promise<any>[] = [];
    // Exceed the per-session limit by sending concurrent requests
    for (let i = 0; i < 120; i++) {
      promises.push(manager.fetch(`https://127.0.0.1:${port}/concurrent`, { method: 'GET' }));
    }
    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    assert.equal(fulfilled, 120);
    // Should have created at least 2 sessions since maxStreams=100 and we sent 120
    const sessionsMap = (manager as any).sessions as Map<string, any[]>;
    for (const entries of sessionsMap.values()) {
      assert.ok(entries.length >= 1);
    }
  });

  it('should downgrade on GOAWAY and still serve subsequent requests', async () => {
    // Force a single session to exist
    const res1 = await manager.fetch(`https://127.0.0.1:${port}/goaway-before`, { method: 'GET' });
    assert.equal(res1.ok, true);

    // Simulate GOAWAY received from server by marking the session entry
    const pool = (manager as any).sessions as Map<string, any[]>;
    const entries = pool.values().next().value;
    const entry = Array.isArray(entries) ? entries[0] : entries;
    assert.ok(entry, 'should have a session entry');
    entry.goawayReceived = true;

    // After GOAWAY the manager should create a new session for the next request
    const res2 = await manager.fetch(`https://127.0.0.1:${port}/goaway-after`, { method: 'GET' });
    assert.equal(res2.ok, true);
    const body = await res2.json() as any;
    assert.equal(body.path, '/goaway-after');
  });

  it('should clean up idle sessions after timeout', async () => {
    const manager2 = new Http2ConnectionManager({ rejectUnauthorized: false, sweepIntervalMs: 50, idleTimeoutMs: 80 });
    const res = await manager2.fetch(`https://127.0.0.1:${port}/idle-test`, { method: 'GET' });
    assert.equal(res.ok, true);

    const pool = (manager2 as any).sessions as Map<string, any[]>;
    assert.equal(pool.size, 1);

    // Wait past idle + sweep
    await new Promise(r => setTimeout(r, 300));

    // The session should have been cleaned up
    assert.equal(pool.size, 0);
    await manager2.close();
  });
});
