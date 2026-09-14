import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Connect dashboard.
 *
 *   - GET /codex/:token  codex provider connection status
 */
export const connectRoutes = new Hono()

  .get("/codex/:token", (c) =>
    c.json({
      connected: false,
      provider: "",
    }),
  );
