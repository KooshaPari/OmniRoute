/**
 * /api/apikeys
 */
import { Hono } from 'hono';
import { ApiKey, ApiKeyCreate } from '@omniroute/shared-types';

export const apikeysRoute = new Hono()
  .get('/', async (c) => {
    if (!c.get('user')) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'login required' } }, 401);
    return c.json({ ok: true, data: [] satisfies ApiKey[] });
  })
  .post('/', async (c) => {
    if (!c.get('user') || c.get('user')?.role === 'viewer') {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'editor role required' } }, 403);
    }
    const body = ApiKeyCreate.parse(await c.req.json());
    // TODO: persist and reveal
    return c.json({ ok: true, data: { id: '01J9X3F4A2B7C5D6E7F8G9H0JK' as ApiKey['id'], secret: 'plain-text-once', fingerprint: 'abcd' } });
  })
  .delete('/:id', async (c) => {
    if (!c.get('user') || c.get('user')?.role === 'viewer') {
      return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'editor role required' } }, 403);
    }
    return c.json({ ok: true, data: { id: c.req.param('id'), revoked: true } });
  });
