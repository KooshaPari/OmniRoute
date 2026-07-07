/**
 * /api/providers — list, create, update providers.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { ProviderCreate, ProviderUpdate, ProviderPublic } from '@omniroute/shared-types';

export const providersRoute = new Hono()
  .get('/', async (c) => {
    if (!c.get('user')) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'login required' } }, 401);
    // TODO: pull from storage
    return c.json({ ok: true, data: [] satisfies ProviderPublic[] });
  })
  .post('/', zValidator('json', ProviderCreate), async (c) => {
    if (!c.get('user') || c.get('user')?.role === 'viewer') {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'editor role required' } }, 403);
    }
    const body = c.req.valid('json');
    // TODO: persist
    return c.json({ ok: true, data: { ...body, status: 'provisioning' as const } satisfies ProviderPublic }, 201);
  })
  .patch('/:id', zValidator('json', ProviderUpdate), async (c) => {
    if (!c.get('user') || c.get('user')?.role === 'viewer') {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'editor role required' } }, 403);
    }
    const body = c.req.valid('json');
    return c.json({ ok: true, data: { ...body, id: c.req.param('id') } });
  })
  .delete('/:id', async (c) => {
    if (!c.get('user') || c.get('user')?.role !== 'owner') {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'owner role required' } }, 403);
    }
    return c.json({ ok: true, data: { id: c.req.param('id'), deleted: true } });
  })
  .post('/:id/health', async (c) => {
    // Proxy to kbridge health
    return c.json({ ok: true, data: { id: c.req.param('id'), status: 'healthy' } });
  });

// Lightweight zValidator substitute — kept local to avoid adding zod-validator dep here.
import type { Context, MiddlewareHandler } from 'hono';
type ZValidatorSchemas = { json?: unknown };
function zValidator<T extends ZValidatorSchemas>(_target: 'json', schema: { parse: (v: unknown) => T['json'] }): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const raw = await c.req.json();
      const parsed = schema.parse(raw);
      c.req.raw.headers.set('x-validated', '1');
      // Hono's zValidator sets c.req.valid() — replicate by stashing on a WeakMap is overkill; do it via locals.
      (c as unknown as { _validated: unknown })._validated = parsed;
      await next();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'invalid';
      return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
    }
  };
}
// Hook c.req.valid via locals: route handlers should read c.get('validated').
