import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Docs dashboard.
 *
 *   - GET /pages   document page listing
 *   - GET /search  search docs by query
 */
export const docsRoutes = new Hono()

  .get("/pages", (c) =>
    c.json({
      pages: [],
      total: 0,
    }),
  )

  .get("/search", (c) => {
    const _q = c.req.query("q") ?? "";
    return c.json({
      results: [],
    });
  });
