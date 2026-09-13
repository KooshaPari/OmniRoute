import { Hono } from "hono";

/**
 * Batch 3 BFF routes — Compression dashboard.
 *
 * Provides mock/placeholder data for the SvelteKit compression pages:
 *   - GET /compression/stats      compression metrics
 *   - GET /compression/ab         A/B compression test
 *   - GET /compression/exclusions  exclusion patterns
 *   - PUT /compression/exclusions  update exclusion patterns
 *   - GET /compression/live        live compression run
 *   - GET /compression/studio      studio compression preview
 */
export const compressionRoutes = new Hono()

  /** Compression metrics matching existing page expectations. */
  .get("/stats", (c) => c.json({
    status: "unavailable",
    source: "placeholder",
    gcfBytes: 0,
    toonBytes: 0,
    jsonBytes: 0,
    prompts: 0,
  }))

  /** A/B compression test endpoint. */
  .post("/ab", async (c) => {
    const { text } = await c.req.json();
    return c.json({
      gcf: "",
      toon: "",
      json: "",
    });
  })

  /** Exclusion patterns for compression. */
  .get("/exclusions", (c) => c.json({
    exclusions: [],
  }))

  .put("/exclusions", async (c) => {
    const { exclusions } = await c.req.json();
    return c.json({ ok: true, exclusions });
  })

  /** Live compression run data. */
  .get("/live", (c) => c.json({
    run: null,
  }))

  /** Studio compression preview. */
  .get("/studio", (c) => c.json({
    text: "",
    mode: "lite",
    result: null,
  }));