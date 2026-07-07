/**
 * Auth middleware — populates c.set('user', ...) from session cookie.
 */
import { createMiddleware } from 'hono/factory';
import { getSession } from '../../auth/session';

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await getSession(c.req.raw.headers);
  c.set('user', session?.user ?? null);
  c.set('requestId', c.get('requestId') ?? crypto.randomUUID());
  await next();
});
