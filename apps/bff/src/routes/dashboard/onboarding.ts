import { Hono } from 'hono';

export const onboardingRoutes = new Hono()

  // GET /api/dashboard/onboarding
  .get('/', (c) => c.json({ steps: [] }))

  // POST /api/dashboard/onboarding
  .post('/', (c) => c.json({ ok: true }));
