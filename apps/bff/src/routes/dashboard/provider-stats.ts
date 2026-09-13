import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Provider statistics.
 *
 *   - GET /api/dashboard/provider-stats
 */
export const providerStatsRoutes = new Hono()

  // GET /api/dashboard/provider-stats
  .get("/", (c) => c.json({ stats: {} }));