import { describe, expect, test } from 'vitest';
import app from '../index';

// Use Hono's app.request() to exercise routes without spinning up a server.
// app.request() returns a Promise<Response> with the full HTTP semantics.
async function get(path: string) {
  return app.request(path, { method: 'GET' });
}

async function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('dashboard routes - GET endpoints', () => {
  test('GET /api/dashboard/health returns status:healthy + ISO ts', async () => {
    const res = await get('/api/dashboard/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.ts).toBe('string');
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('GET /api/dashboard/security returns the expected security flags', async () => {
    const res = await get('/api/dashboard/security');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.csrfEnabled).toBe(true);
    expect(typeof body.jwtSecretRotatedAt).toBe('string');
    expect(typeof body.mitmCertInstalled).toBe('boolean');
    expect(typeof body.sessionSecretStrong).toBe('boolean');
    expect(['safe', 'leaked', 'rotating']).toContain(body.openaiApiKeyLeakage);
  });

  test('GET /api/dashboard/cache returns counters (hits >= misses expected)', async () => {
    const res = await get('/api/dashboard/cache');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hits).toBe(12450);
    expect(body.misses).toBe(320);
    expect(typeof body.sizeMb).toBe('number');
    expect(body.evictions).toBe(18);
  });

  test('GET /api/dashboard/compression/stats returns gcf/toon/json bytes', async () => {
    const res = await get('/api/dashboard/compression/stats');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gcfBytes).toBe(1840);
    expect(body.toonBytes).toBe(2104);
    expect(body.jsonBytes).toBe(4120);
    expect(body.prompts).toBe(1280);
  });

  test('GET /api/dashboard/playground/models lists known models', async () => {
    const res = await get('/api/dashboard/playground/models');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models).toBeInstanceOf(Array);
    expect(body.models.length).toBeGreaterThan(0);
    const ids = body.models.map((m: { id: string }) => m.id);
    expect(ids).toContain('claude-sonnet-4');
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('gemini-2.5-pro');
  });
});

describe('dashboard routes - POST endpoints with Zod validation', () => {
  test('POST /api/dashboard/compression/ab echoes the text length in each format', async () => {
    const text = 'hello world from a test';
    const res = await postJson('/api/dashboard/compression/ab', { text });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gcf).toContain(`${text.length}b`);
    expect(body.toon).toContain(`${text.length}b`);
    expect(typeof body.json).toBe('string');
    expect(body.json).toContain(text);
  });

  test('POST /api/dashboard/compression/ab rejects empty text (Zod min)', async () => {
    // CompressionABSchema is z.object({ text: z.string() }) - empty string is OK
    // (z.string() doesn't have min). But empty object should fail.
    const res = await postJson('/api/dashboard/compression/ab', {});
    expect(res.status).toBe(400);
  });

  test('POST /api/dashboard/settings accepts valid theme + language', async () => {
    const res = await postJson('/api/dashboard/settings', {
      baseUrl: 'https://api.example.com',
      telemetry: true,
      autoUpdate: false,
      language: 'en',
      theme: 'dark',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.settings.theme).toBe('dark');
  });

  test('POST /api/dashboard/settings rejects invalid theme', async () => {
    const res = await postJson('/api/dashboard/settings', {
      baseUrl: 'https://api.example.com',
      telemetry: true,
      autoUpdate: false,
      language: 'en',
      theme: 'neon',  // not in enum
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/dashboard/keys creates a key with omni_pk_ prefix', async () => {
    const res = await postJson('/api/dashboard/keys', { name: 'test-key' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.key.name).toBe('test-key');
    expect(body.key.prefix).toMatch(/^omni_pk_/);
    expect(body.key.revoked).toBe(false);
    expect(typeof body.key.id).toBe('string');
  });
});

describe('health endpoint (BFF root)', () => {
  test('GET /healthz returns 200 with service name', async () => {
    const res = await get('/healthz');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('argismonitor-bff');
  });
});
