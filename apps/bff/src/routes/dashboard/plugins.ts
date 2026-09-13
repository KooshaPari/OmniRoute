import { Hono } from "hono";

/**
 * Batch 2 BFF routes — Plugin ecosystem.
 *
 *   - GET  /            list installed plugins
 *   - GET  /:name       plugin detail
 *   - GET  /:name/config  plugin configuration schema
 *   - PUT  /:name/config  update plugin configuration
 */
export const pluginsRoutes = new Hono()

  .get("/", (c) =>
    c.json({
      plugins: [
        {
          name: "compression-gcf",
          displayName: "GCF Compression",
          version: "1.2.0",
          enabled: true,
          description: "Google Compression Format encoder for prompt compression",
          author: "omniroute",
          category: "compression",
        },
        {
          name: "compression-toon",
          displayName: "TOON Compression",
          version: "0.9.1",
          enabled: false,
          description: "TOON best-of-N encoder for prompt compression",
          author: "omniroute",
          category: "compression",
        },
        {
          name: "model-router",
          displayName: "Model Router",
          version: "2.0.0",
          enabled: true,
          description: "Intelligent model routing based on latency and cost",
          author: "omniroute",
          category: "routing",
        },
        {
          name: "telemetry-exporter",
          displayName: "Telemetry Exporter",
          version: "1.0.0",
          enabled: false,
          description: "Export metrics to external observability platforms",
          author: "omniroute",
          category: "monitoring",
        },
      ],
    })
  )

  .get("/:name", (c) =>
    c.json({
      name: c.req.param("name"),
      displayName: "Plugin Display Name",
      version: "1.0.0",
      description: "Plugin description",
      author: "omniroute",
      category: "custom",
      enabled: true,
      settings: {},
    })
  )

  .get("/:name/config", (c) =>
    c.json({
      name: c.req.param("name"),
      schema: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether the plugin is enabled" },
          options: { type: "object", description: "Plugin-specific options" },
        },
      },
      current: {
        enabled: true,
        options: {},
      },
    })
  )

  .put("/:name/config", async (c) => {
    const body = await c.req.json();
    return c.json({ ok: true, name: c.req.param("name"), config: body });
  });
