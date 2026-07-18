import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { dashboardRoutes } from './routes/dashboard';
import { proxyRoutes } from './routes/proxy';
import { gatewayRoutes } from './routes/gateway/proxy';
import { trpcRoutes } from './trpc/hono';
import { z } from 'zod';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({ origin: ['http://localhost:4321'], credentials: true }));

app.get('/healthz', (c) => c.json({ status: 'ok', service: 'argismonitor-bff' }));

const WebVitalSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.enum(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']),
  value: z.number().finite().nonnegative(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  delta: z.number().finite(),
  navigationType: z.string().min(1).max(64),
  ts: z.number().int().positive(),
}).strict();

app.post('/api/v1/telemetry/web-vitals', async (c) => {
  if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) {
    return c.json({ error: 'content-type must be application/json' }, 415);
  }

  const declaredLength = Number(c.req.header('content-length') ?? 0);
  if (declaredLength > 4096) return c.json({ error: 'payload too large' }, 413);

  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > 4096) {
    return c.json({ error: 'payload too large' }, 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return c.json({ error: 'invalid JSON' }, 400);
  }
  const parsed = WebVitalSchema.safeParse(json);
  if (!parsed.success) return c.json({ error: 'invalid web vital' }, 400);

  console.info('[bff:telemetry:web-vital]', JSON.stringify(parsed.data));
  return c.json({ accepted: true, id: parsed.data.id }, 202);
});

app.route('/api/dashboard', dashboardRoutes);
app.route('/api/v1', proxyRoutes);
app.route('/api/dashboard/gateway', gatewayRoutes);
app.route('/api/trpc', trpcRoutes);

export type AppType = typeof app;
export default app;
