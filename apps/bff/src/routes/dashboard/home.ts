import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Home dashboard.
 *
 *   - GET /summary          dashboard summary stats
 *   - GET /recent-activity  recent activity feed
 */
export const homeRoutes = new Hono()

  .get("/summary", (c) =>
    c.json({
      activeProviders: 0,
      totalRequests: 0,
      uptime: 0,
    }),
  )

  .get("/recent-activity", (c) =>
    c.json({
      activities: [],
    }),
  );
