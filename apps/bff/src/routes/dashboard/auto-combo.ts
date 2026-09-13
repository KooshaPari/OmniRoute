import { Hono } from 'hono';

export const autoComboRoutes = new Hono()

  // GET /api/dashboard/auto-combo
  .get('/', (c) => c.json({ combo: null }))

  // POST /api/dashboard/auto-combo
  .post('/', (c) => c.json({ ok: true }));
