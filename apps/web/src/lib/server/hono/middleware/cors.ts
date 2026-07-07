import { createMiddleware } from 'hono/factory';
import { config } from '../../env';

export const corsMiddleware = createMiddleware(async (c, next) => {
  const origin = c.req.header('origin');
  if (origin && origin.startsWith(config.PUBLIC_WEB_URL)) {
    c.header('access-control-allow-origin', origin);
    c.header('access-control-allow-credentials', 'true');
    c.header('vary', 'Origin');
    c.header('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    c.header('access-control-allow-headers', 'authorization,content-type,x-request-id,x-csrf-token');
    c.header('access-control-max-age', '600');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});
