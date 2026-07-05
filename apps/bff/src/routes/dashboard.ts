import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ProviderSchema } from '@omniroute/api-contracts';

export const dashboardRoutes = new Hono()
  .get('/health', (c) => c.json({ status: 'healthy', ts: new Date().toISOString() }))
  .get('/providers', (c) => c.json({ providers: [] }))
  .post(
    '/providers',
    zValidator('json', ProviderSchema),
    (c) => c.json({ ok: true, provider: c.req.valid('json') })
  );
