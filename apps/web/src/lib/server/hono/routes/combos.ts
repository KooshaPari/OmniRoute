/**
 * /api/combos — list, create, resolve (kbridge-backed).
 */
import { Hono } from 'hono';
import { Combo, ComboResolveRequest, ComboResolveResult } from '@omniroute/shared-types';

export const combosRoute = new Hono()
  .get('/', async (c) => {
    if (!c.get('user')) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'login required' } }, 401);
    return c.json({ ok: true, data: [] satisfies Combo[] });
  })
  .post('/', async (c) => {
    if (!c.get('user') || c.get('user')?.role === 'viewer') {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'editor role required' } }, 403);
    }
    const body = await c.req.json() as Combo;
    return c.json({ ok: true, data: body }, 201);
  })
  .post('/resolve', async (c) => {
    if (!c.get('user')) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'login required' } }, 401);
    const body = ComboResolveRequest.parse(await c.req.json());
    // TODO: forward to kbridge via app/web/src/lib/server/hono/routes/kbridge.ts → apps/web/src/lib/client/kbridge.ts → BFF
    return c.json({
      ok: true,
      data: {
        combo: {} as Combo,
        resolvedSteps: [],
        totalWeight: 0,
        estimatedCost: { promptMicroCents: 0n, completionMicroCents: 0n },
      } satisfies ComboResolveResult,
    });
  });
