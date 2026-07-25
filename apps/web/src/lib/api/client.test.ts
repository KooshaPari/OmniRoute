import { describe, expect, test, vi, afterEach } from 'vitest';
import { apiGet } from './client';

describe('apiGet', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('calls fetch with the BFF base URL + path', async () => {
    let capturedUrl: string | undefined;
    let capturedCreds: RequestCredentials | undefined;
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = String(url);
      capturedCreds = 'include' as RequestCredentials;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as any;

    const result = await apiGet<{ ok: boolean }>('/api/v1/foo');
    expect(result).toEqual({ ok: true });
    expect(capturedUrl).toBe('http://localhost:4322/api/v1/foo');
    expect(capturedCreds).toBe('include');
  });

  test('throws Error on non-2xx response', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('not found', { status: 404 })
    ) as any;

    await expect(apiGet('/api/v1/missing')).rejects.toThrow('API /api/v1/missing failed: 404');
  });

  test('returns parsed JSON body on 2xx', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ items: [1, 2, 3], count: 3 }), { status: 200 })
    ) as any;

    const result = await apiGet<{ items: number[]; count: number }>('/api/v1/list');
    expect(result).toEqual({ items: [1, 2, 3], count: 3 });
  });

  test('throws Error on 500 response with status code', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('server error', { status: 500 })
    ) as any;

    await expect(apiGet('/api/v1/x')).rejects.toThrow('failed: 500');
  });

  test('includes credentials in fetch options', async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url: any, init?: RequestInit) => {
      capturedInit = init;
      return new Response('{}', { status: 200 });
    }) as any;

    await apiGet('/test');
    expect(capturedInit).toBeDefined();
    expect(capturedInit?.credentials).toBe('include');
  });
});
