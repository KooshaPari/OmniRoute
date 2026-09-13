import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Provider management.
 *
 * Covers:
 *   - GET /api/dashboard/providers          list providers
 *   - GET /api/dashboard/providers/:id      provider detail
 *   - POST /api/dashboard/providers         create provider
 *   - GET /api/dashboard/providers/services/:id provider services
 */
export const providersRoutes = new Hono()

  // GET /api/dashboard/providers
  .get("/", (c) => c.json({ providers: [] }))

  // GET /api/dashboard/providers/:id
  .get("/:id", (c) => {
    const id = c.req.param("id");
    return c.json({ id, name: `Provider ${id}`, type: "openai", config: {} });
  })

  // POST /api/dashboard/providers
  .post("/", (c) => c.json({ ok: true }))

  // GET /api/dashboard/providers/services/:id
  .get("/services/:id", (c) => {
    const id = c.req.param("id");
    return c.json({ services: [] });
  });