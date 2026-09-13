import { Hono } from 'hono';

/**
 * Batch 6 BFF routes — Cache media listing.
 *
 *   - GET /api/dashboard/cache/media   cached media items
 */
export const cacheRoutes = new Hono()

  // GET /api/dashboard/cache/media
  .get('/media', (c) =>
    c.json({
      items: [],
      total: 0,
      hitRate: 0,
    }),
  );
