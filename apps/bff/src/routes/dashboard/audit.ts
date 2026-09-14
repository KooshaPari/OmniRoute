import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Audit dashboard.
 *
 *   - GET /a2a   a2a session listing
 *   - GET /mcp   mcp server listing
 */
export const auditRoutes = new Hono()

  .get("/a2a", (c) =>
    c.json({
      sessions: [],
      total: 0,
    }),
  )

  .get("/mcp", (c) =>
    c.json({
      servers: [],
      total: 0,
    }),
  );
