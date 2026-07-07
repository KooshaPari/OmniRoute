/** Lightweight access log. */
import { createMiddleware } from 'hono/factory';

export const accessLog = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.info(`[${c.req.method}] ${c.req.path} ${c.res.status} ${ms}ms`);
});
