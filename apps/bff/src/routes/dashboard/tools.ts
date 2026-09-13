import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Tools search.
 *
 *   - GET /api/dashboard/tools/search-tools
 */
export const toolsRoutes = new Hono()

  // GET /api/dashboard/tools/search-tools
  .get("/search-tools", (c) => c.json({ tools: [] }));