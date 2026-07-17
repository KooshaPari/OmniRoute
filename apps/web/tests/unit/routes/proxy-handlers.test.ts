import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/bff', () => ({ bffUrl: (path: string) => `http://bff.test${path}` }));

import { GET } from '../../../src/routes/api/bff/healthz/+server';
import { POST } from '../../../src/routes/api/v1/telemetry/web-vitals/+server';

describe('typed proxy route handlers', () => {
  it('preserves the BFF health response', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const response = await GET({ fetch } as unknown as Parameters<typeof GET>[0]);

    expect(fetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
  });

  it('preserves the telemetry request body', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(init?.body, { status: 202, headers: { 'content-type': 'application/json' } }));
    const request = new Request('http://localhost/api/v1/telemetry/web-vitals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"LCP","value":1}',
    });
    const response = await POST({ request, fetch } as unknown as Parameters<typeof POST>[0]);

    expect(fetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(202);
    expect(await response.text()).toBe('{"name":"LCP","value":1}');
  });

  it('rejects telemetry without content-type as 415', async () => {
    const request = new Request('http://localhost/api/v1/telemetry/web-vitals', {
      method: 'POST',
      body: '{"name":"LCP","value":1}',
    });

    await expect(POST({ request, fetch: vi.fn() } as unknown as Parameters<typeof POST>[0]))
      .rejects.toMatchObject({ status: 415 });
  });
});
