import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { dashboardRoutes } from './routes/dashboard';
import { settingsRoutes } from './routes/dashboard/settings';
import { analyticsRoutes } from './routes/dashboard/analytics';
import { compressionRoutes } from './routes/dashboard/compression';
import { logsRoutes } from './routes/dashboard/logs';
import { activityRoutes } from './routes/dashboard/activity';
import { pluginsRoutes } from './routes/dashboard/plugins';
import { providersRoutes } from './routes/dashboard/providers';
import { agentsRoutes } from './routes/dashboard/agents';
import { tokensRoutes } from './routes/dashboard/tokens';
import { providerStatsRoutes } from './routes/dashboard/provider-stats';
import { skillsRoutes } from './routes/dashboard/skills';
import { toolsRoutes } from './routes/dashboard/tools';
import { autoComboRoutes } from './routes/dashboard/auto-combo';
import { gamificationRoutes } from './routes/dashboard/gamification';
import { mediaProvidersRoutes } from './routes/dashboard/media-providers';
import { onboardingRoutes } from './routes/dashboard/onboarding';
import { gatewayRoutes } from './routes/gateway/proxy';
import { trpcRoutes } from './trpc/hono';
import { requireAuthOrSession } from './middleware/auth';
import { parseCorsOrigins } from './cors-origins';
import { env } from './env';
import { z } from 'zod';

const app = new Hono();
const corsOrigins = parseCorsOrigins(env.BFF_CORS_ORIGINS);

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : ['http://localhost:4321'],
    credentials: true,
  }),
);

app.get('/healthz', (c) => c.json({ status: 'ok', service: 'argismonitor-bff' }));

/**
 * Production trust boundary (#392):
 * - Machine clients: Bearer / x-api-key == BFF_API_KEY
 * - Browser clients: session cookie from /api/auth/* (never BFF_API_KEY in the browser)
 */
const authenticate = requireAuthOrSession();
const protectInProduction = async (
  c: Parameters<typeof authenticate>[0],
  next: Parameters<typeof authenticate>[1],
) => {
  if (env.NODE_ENV !== 'production') return next();
  return authenticate(c, next);
};

app.use('/api/dashboard/*', protectInProduction);
app.use('/api/trpc/*', protectInProduction);
app.use('/api/v1/*', async (c, next) => {
  if (c.req.path === '/api/v1/telemetry/web-vitals') return next();
  return protectInProduction(c, next);
});

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
app.route('/api/dashboard/settings', settingsRoutes);
app.route('/api/dashboard/plugins', pluginsRoutes);
app.route('/api/dashboard/analytics', analyticsRoutes);
app.route('/api/dashboard/compression', compressionRoutes);
app.route('/api/dashboard/logs', logsRoutes);
app.route('/api/dashboard/activity', activityRoutes);
app.route('/api/dashboard/providers', providersRoutes);
app.route('/api/dashboard/agents', agentsRoutes);
app.route('/api/dashboard/tokens', tokensRoutes);
app.route('/api/dashboard/provider-stats', providerStatsRoutes);
app.route('/api/dashboard/skills', skillsRoutes);
app.route('/api/dashboard/tools', toolsRoutes);
app.route('/api/dashboard/auto-combo', autoComboRoutes);
app.route('/api/dashboard/gamification', gamificationRoutes);
app.route('/api/dashboard/media-providers', mediaProvidersRoutes);
app.route('/api/dashboard/onboarding', onboardingRoutes);
app.route('/api/v1', proxyRoutes);
app.route('/api/auth', authProxyRoutes);
app.route('/api/dashboard/gateway', gatewayRoutes);
app.route('/api/trpc', trpcRoutes);

export type AppType = typeof app;
export default app;
