/**
 * /api/usage — list + aggregate
 */
import { Hono } from 'hono';
import { UsageAggregate, UsageQuery } from '@omniroute/shared-types';

export const usageRoute = new Hono()
  .get('/', async (c) => {
    if (!c.get('user')) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'login required' } }, 401);
    const q = UsageQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return c.json({ ok: true, data: [] });
  })
  .get('/aggregate', async (c) => {
    if (!c.get('user')) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'login required' } }, 401);
    const q = UsageQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return c.json({
      ok: true,
      data: {
        windowStart: new Date(Date.now() - 86400_000).toISOString(),
        windowEnd: new Date().toISOString(),
        totalRequests: 0, totalPromptTokens: 0, totalCompletionTokens: 0,
        totalCost: 0n, averageLatencyMs: 0, errorRate: 0,
      } satisfies UsageAggregate,
    });
  });
