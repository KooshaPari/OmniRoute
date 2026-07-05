import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { ProviderSchema } from '@omniroute/api-contracts';

const SettingsSchema = z.object({
  baseUrl: z.string().url(),
  telemetry: z.boolean(),
  autoUpdate: z.boolean(),
  language: z.string(),
  theme: z.enum(['auto', 'light', 'dark']),
});
const KeyCreateSchema = z.object({ name: z.string().min(1).max(100) });

export const dashboardRoutes = new Hono()
  .get('/health', (c) => c.json({ status: 'healthy', ts: new Date().toISOString() }))
  .get('/providers', (c) => c.json({ providers: [] }))
  .post('/providers', zValidator('json', ProviderSchema), (c) => c.json({ ok: true, provider: c.req.valid('json') }))
  .get('/usage', (c) => c.json({ rows: [] }))
  .get('/combos', (c) => c.json({ combos: [] }))
  .get('/security', (c) => c.json({
    csrfEnabled: true, jwtSecretRotatedAt: '2026-06-15T00:00:00Z',
    mitmCertInstalled: false, sessionSecretStrong: true, openaiApiKeyLeakage: 'safe',
  }))
  .get('/keys', (c) => c.json({ keys: [] }))
  .post('/keys', zValidator('json', KeyCreateSchema), (c) => c.json({
    ok: true,
    key: { id: crypto.randomUUID(), name: c.req.valid('json').name, prefix: 'omni_pk_' + Math.random().toString(36).slice(2, 10), createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false },
  }))
  .post('/keys/:id/revoke', (c) => c.json({ ok: true, id: c.req.param('id') }))
  .get('/settings', (c) => c.json({ baseUrl: 'http://localhost:20128', telemetry: true, autoUpdate: true, language: 'en', theme: 'auto' }))
  .post('/settings', zValidator('json', SettingsSchema), (c) => c.json({ ok: true, settings: c.req.valid('json') }))
  .get('/cost', (c) => c.json({ rows: [] }))
  .get('/billing', (c) => c.json({ name: 'Pro', pricePerMonth: 49, seats: 5, renewsAt: '2026-08-01' }))
  .get('/logs', (c) => c.json({ logs: [] }))
  .get('/mcp', (c) => c.json({ servers: [] }))
  .get('/a2a', (c) => c.json({ agents: [] }))
  .get('/skills', (c) => c.json({ skills: [] }))
  .get('/memory', (c) => c.json({ entries: [] }))
  .get('/cache', (c) => c.json({ hits: 12450, misses: 320, sizeMb: 42, evictions: 18 }))
  .get('/batch', (c) => c.json({ batches: [] }))
  .get('/webhooks', (c) => c.json({ webhooks: [] }))
  .get('/audit', (c) => c.json({ events: [] }))
  .get('/health/stream', (c) => {
    return streamSSE(c, async (stream) => {
      let id = 0;
      const send = async (level: 'info'|'warn'|'error', message: string) => {
        await stream.writeSSE({
          id: String(id++), event: 'health',
          data: JSON.stringify({ ts: new Date().toISOString(), level, message }),
        });
      };
      await send('info', 'SSE stream connected');
      const interval = setInterval(() => {
        send('info', `heartbeat @ ${new Date().toLocaleTimeString()}`).catch(() => {});
      }, 5000);
      stream.onAbort(() => clearInterval(interval));
      await new Promise<void>((resolve) => stream.onAbort(() => resolve()));
    });
  });
