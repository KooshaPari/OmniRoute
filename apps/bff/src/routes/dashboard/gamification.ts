import { Hono } from 'hono';

export const gamificationRoutes = new Hono()

  // GET /api/dashboard/gamification/admin
  .get('/admin', (c) => c.json({ admin: {} }));
