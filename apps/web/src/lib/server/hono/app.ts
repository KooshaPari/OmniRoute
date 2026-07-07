/**
 * Hono 4 application — composed from /api/* route modules.
 * Mounted via hooks.server.ts → handle.fetch for /api/* requests.
 */
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { compress } from 'hono/compress';
import { timing } from 'hono/timing';
import { requestId } from 'hono/request-id';
import { authMiddleware } from './middleware/auth';
import { ratelimitMiddleware } from './middleware/ratelimit';
import { corsMiddleware } from './middleware/cors';
import { providersRoute } from './routes/providers';
import { combosRoute } from './routes/combos';
import { apikeysRoute } from './routes/apikeys';
import { chatRoute } from './routes/chat';
import { usageRoute } from './routes/usage';
import { healthRoute } from './routes/health';
import { authRoute } from './routes/auth';
import { kbridgeRoute } from './routes/kbridge';

type AppEnv = {
  Variables: {
    requestId: string;
    user: { id: string; role: 'owner' | 'admin' | 'operator' | 'viewer' } | null;
  };
};

export const honoApp = new Hono<AppEnv>()
  .use('*', requestId())
  .use('*', timing())
  .use('*', secureHeaders())
  .use('*', compress())
  .use('*', logger())
  .use('*', corsMiddleware)
  .use('*', authMiddleware)
  .use('/api/*', ratelimitMiddleware)
  .route('/api/providers', providersRoute)
  .route('/api/combos', combosRoute)
  .route('/api/apikeys', apikeysRoute)
  .route('/api/chat', chatRoute)
  .route('/api/usage', usageRoute)
  .route('/api/health', healthRoute)
  .route('/api/auth', authRoute)
  .route('/api/kbridge', kbridgeRoute)
  .get('/api/health/ready', (c) => c.json({ ok: true, status: 'ready' }))
  .notFound((c) => c.json({ ok: false, error: { code: 'NOT_FOUND', message: `route ${c.req.path} not found` } }, 404))
  .onError((err, c) => {
    console.error('[hono]', err);
    return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
  });

export type AppType = typeof honoApp;
