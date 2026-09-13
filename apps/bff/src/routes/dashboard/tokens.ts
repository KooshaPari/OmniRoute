import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Token management.
 *
 *   - GET /api/dashboard/tokens
 */
export const tokensRoutes = new Hono()

  // GET /api/dashboard/tokens
  .get("/", (c) => c.json({ tokens: [] }));