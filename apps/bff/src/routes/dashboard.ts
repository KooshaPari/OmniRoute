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

const UsageRowSchema = z.object({
  id: z.string(),
  provider: z.string(),
  model: z.string(),
  requests: z.number(),
  tokens: z.number(),
  cost: z.number(),
  date: z.string(),
});

export const dashboardRoutes = new Hono()
  .get('/health', (c) => c.json({ status: 'healthy', ts: new Date().toISOString() }))
  .get('/providers', (c) => c.json({ providers: [] }))
  .post(
    '/providers',
    zValidator('json', ProviderSchema),
    (c) => c.json({ ok: true, provider: c.req.valid('json') })
  )
  .get('/usage', (c) => c.json({ rows: [] }))
  .post(
    '/settings',
    zValidator('json', SettingsSchema),
    (c) => c.json({ ok: true, settings: c.req.valid('json') })
  )
  .get('/settings', (c) => c.json({
    baseUrl: 'http://localhost:20128',
    telemetry: true,
    autoUpdate: true,
    language: 'en',
    theme: 'auto',
  }))
  .get('/health/stream', (c) => {
    return streamSSE(c, async (stream) => {
      let id = 0;
      const send = async (level: 'info' | 'warn' | 'error', message: string) => {
        await stream.writeSSE({
          id: String(id++),
          event: 'health',
          data: JSON.stringify({ ts: new Date().toISOString(), level, message }),
        });
      };
      await send('info', 'SSE stream connected');
      // Emit a fake event every 5s
      const interval = setInterval(() => {
        send('info', `heartbeat @ ${new Date().toLocaleTimeString()}`).catch(() => {});
      }, 5000);
      stream.onAbort(() => clearInterval(interval));
      // Keep the stream open
      await new Promise<void>((resolve) => stream.onAbort(() => resolve()));
    });
  });
