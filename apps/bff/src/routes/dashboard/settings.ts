import { Hono } from "hono";

/**
 * Batch 2 BFF routes — Settings ecosystem sub-pages.
 *
 * Covers settings sub-pages NOT already in dashboard.ts:
 *   - /advanced       advanced settings
 *   - /ai             AI / LLM configuration
 *   - /appearance     theme and appearance
 *   - /database       database settings
 *   - /developer      developer options
 *   - /email          email configuration
 *   - /paths          file paths
 *   - /system         system information
 */
export const settingsRoutes = new Hono()

  .get("/advanced", (c) =>
    c.json({
      debug: false,
      logLevel: "info",
      maxConcurrentRequests: 10,
      requestTimeoutMs: 30000,
      cacheEnabled: true,
      cacheTtlSeconds: 300,
      compressionEnabled: true,
      rateLimitPerMinute: 60,
    })
  )
  .put("/advanced", (c) => c.json({ ok: true }))

  .get("/ai", (c) =>
    c.json({
      defaultProvider: "openai",
      defaultModel: "gpt-4o",
      temperature: 0.7,
      maxTokens: 4096,
      streamingEnabled: true,
      systemPrompt: "",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
    })
  )
  .put("/ai", (c) => c.json({ ok: true }))

  .get("/appearance", (c) =>
    c.json({
      theme: "auto",
      accentColor: "#3b82f6",
      fontSize: "medium",
      sidebarCollapsed: false,
      compactMode: false,
      showAnimations: true,
    })
  )
  .put("/appearance", (c) => c.json({ ok: true }))

  .get("/database", (c) =>
    c.json({
      engine: "sqlite",
      path: undefined,
      host: undefined,
      port: 5432,
      username: undefined,
      database: undefined,
    })
  )
  .put("/database", (c) => c.json({ ok: true }))

  .get("/developer", (c) =>
    c.json({
      devMode: false,
      verboseLogging: false,
      apiDocs: true,
      playground: true,
      hotReload: false,
      sourceMaps: false,
      experimental: false,
    })
  )
  .put("/developer", (c) => c.json({ ok: true }))

  .get("/email", (c) =>
    c.json({
      smtpHost: undefined,
      smtpPort: 587,
      smtpUser: undefined,
      smtpPassword: undefined,
      fromAddress: undefined,
      senderName: undefined,
    })
  )
  .put("/email", (c) => c.json({ ok: true }))

  .get("/paths", (c) =>
    c.json({
      uploadsDir: "/app/uploads",
      templatesDir: "/app/templates",
      logsDir: "/app/logs",
      configDir: "/app/config",
    })
  )
  .put("/paths", (c) => c.json({ ok: true }))

  .get("/system", (c) =>
    c.json({
      hostname: process.hostname(),
      platform: process.platform,
      memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      cpuUsage: Math.random().toFixed(2),
    })
  )
  .put("/system", (c) => c.json({ ok: true }));
