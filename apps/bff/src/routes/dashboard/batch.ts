import { Hono } from 'hono';

/**
 * Batch 6 BFF routes — Batch job file listing.
 *
 *   - GET /api/dashboard/batch/files   batch files
 */
export const batchRoutes = new Hono()

  // GET /api/dashboard/batch/files
  .get('/files', (c) =>
    c.json({
      items: [],
      total: 0,
    }),
  );
