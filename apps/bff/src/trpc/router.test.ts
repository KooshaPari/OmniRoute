import { describe, expect, test } from 'vitest';
import app from '../index';

// These tests invoke the trpc fetch handler through the BFF's Hono app.
// Each trpc procedure is callable via GET /api/trpc/<router>.<procedure>?input=...
// or POST /api/trpc/<router>.<procedure> with {input: ...} body for mutations.

async function callTrpcQuery(procedure: string, input?: unknown) {
  // GET for queries
  const url = input
    ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `/api/trpc/${procedure}`;
  const res = await app.request(url, { method: 'GET' });
  return res;
}

async function callTrpcMutation(procedure: string, input: unknown) {
  // trpc 11 uses batching: POST /<path>?batch=1 with body {0: {json: input}}
  // Response is {0: {result: {data: ...}}}.
  const res = await app.request(`/api/trpc/${procedure}?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ '0': { json: input } }),
  });
  return res;
}

// Helper: extract the actual data from a trpc batch response (which is {0: {result: {data: ...}}})
async function readTrpcMutationBody(res: Response) {
  const body = await res.json();
  return body?.['0']?.result?.data ?? body;
}

describe('trpc - health', () => {
  test('GET /trpc/health returns { status, ts }', async () => {
    const res = await callTrpcQuery('health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.data.status).toBe('ok');
    expect(typeof body.result.data.ts).toBe('string');
    expect(body.result.data.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('trpc - providers', () => {
  test('GET /trpc/providers.list returns []', async () => {
    const res = await callTrpcQuery('providers.list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.data).toEqual([]);
  });

  test('GET /trpc/providers.byId with missing id returns null (or validation error)', async () => {
    // Procedure requires {id: string}. Calling without input should be a validation error.
    const res = await callTrpcQuery('providers.byId');
    expect([400, 404, 500]).toContain(res.status);
  });

  // Direct procedure test: avoids trpc HTTP batching complexity by calling the
  // procedure as a regular function. Verifies the router logic.
  test('providers.byId procedure returns null for any id (not implemented)', async () => {
    const { appRouter } = await import('./router');
    const caller = appRouter.createCaller({});
    const result = await caller.providers.byId({ id: 'p1' });
    expect(result).toBeNull();
  });

  test('providers.create procedure echoes the input provider', async () => {
    const { appRouter } = await import('./router');
    const caller = appRouter.createCaller({});
    const input = { id: 'p1', name: 'Anthropic Test', type: 'anthropic' as const, config: { apiKey: 'sk-test-1234' } };
    const result = await caller.providers.create(input);
    expect(result.ok).toBe(true);
    expect(result.provider.id).toBe('p1');
    expect(result.provider.name).toBe('Anthropic Test');
    expect((result.provider as any).type).toBe('anthropic');
  });

  test('POST /trpc/providers.create with invalid type returns 400', async () => {
    // type=unknown is invalid - 400 expected
    const res = await callTrpcMutation('providers.create', { id: 'p1', name: 'X', type: 'unknown' });
    expect(res.status).toBe(400);
  });
});

describe('trpc - combos', () => {
  test('GET /trpc/combos.list returns []', async () => {
    const res = await callTrpcQuery('combos.list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.data).toEqual([]);
  });

  test('combos.create procedure echoes the input combo', async () => {
    const { appRouter } = await import('./router');
    const caller = appRouter.createCaller({});
    const input = { id: 'c1', name: 'Primary + fallback', primary: 'claude-sonnet-4', fallbacks: ['gpt-4o'] };
    const result = await caller.combos.create(input);
    expect(result.ok).toBe(true);
    expect(result.combo.id).toBe('c1');
    expect(result.combo.primary).toBe('claude-sonnet-4');
  });
});

describe('trpc - usage + cost + keys', () => {
  test('GET /trpc/usage.list returns []', async () => {
    const res = await callTrpcQuery('usage.list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.data).toEqual([]);
  });

  test('GET /trpc/cost.list returns []', async () => {
    const res = await callTrpcQuery('cost.list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.data).toEqual([]);
  });

  test('GET /trpc/keys.list returns []', async () => {
    const res = await callTrpcQuery('keys.list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.data).toEqual([]);
  });

  test('keys.create procedure returns ok', async () => {
    const { appRouter } = await import('./router');
    const caller = appRouter.createCaller({});
    const result = await caller.keys.create({ name: 'test-key' });
    expect(result.ok).toBe(true);
  });
});
