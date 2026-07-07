/**
 * /api/health — proxies to kbridge via app-side bridge.
 */
import { Hono } from 'hono';
import { HealthReport } from '@omniroute/shared-types';
import { callKbridge } from './kbridge';

export const healthRoute = new Hono()
  .get('/', async (c) => {
    const user = c.get('user');
    const id = c.get('requestId') ?? crypto.randomUUID();
    const reply = await callKbridge({ id, op: 'health' });
    if (!reply.ok) {
      return c.json({ ok: false, error: { code: 'BAD_GATEWAY', message: reply.error.message } }, 502);
    }
    const report: HealthReport = HealthReport.parse({
      status: 'healthy',
      version: '4.0.0',
      uptimeSeconds: 0,
      components: [],
      timestamp: new Date().toISOString(),
      ...reply.data,
    });
    return c.json({ ok: true, data: report });
  });
