import { describe, expect, test } from 'vitest';

describe('gateway proxy routes', () => {
  test('GET /ping returns 503 when kbridge is not configured', async () => {
    // Default test env has no OMNIROUTE_GATEWAY_SOCKET set, so kbridge is unavailable
    const { default: app } = await import('../../index');
    const res = await app.request('/api/dashboard/gateway/ping', { method: 'GET' });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toContain('gateway socket not configured');
  });

  test('GET /health returns 503 when kbridge is not configured', async () => {
    const { default: app } = await import('../../index');
    const res = await app.request('/api/dashboard/gateway/health', { method: 'GET' });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toContain('gateway socket not configured');
  });
});
