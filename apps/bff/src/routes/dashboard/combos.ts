import { Hono } from "hono";

/**
 * Batch 5 BFF routes — Combos dashboard.
 *
 * Provides mock/placeholder data for the SvelteKit Combos pages:
 *   - GET /:id          combo detail (used by detail page)
 *   - GET /live         live run data
 *   - GET /playground   playground/test data
 */
export const combosRoutes = new Hono()

  /** Combo detail by ID. */
  .get("/:id", (c) => {
    const id = c.req.param("id");
    return c.json({
      id,
      name: `Combo ${id}`,
      primary: "openai/gpt-4o",
      fallbacks: [
        { model: "anthropic/claude-3-5-sonnet", condition: "on-error" },
        { model: "google/gemini-pro", condition: "on-rate-limit" },
      ],
      strategy: "cost-optimized",
      successRate: 0.94,
      avgLatencyMs: 1250,
      createdAt: "2026-09-01T10:30:00Z",
      updatedAt: "2026-09-13T08:15:00Z",
    });
  })

  /** Live run stats for combos. */
  .get("/live", (c) => c.json({
    totalRequests: 12450,
    successful: 11728,
    failed: 722,
    fallbackRate: 0.058,
    avgLatencyMs: 1420,
    p95LatencyMs: 2800,
    costSavedUsd: 42.50,
    lastUpdated: new Date().toISOString(),
  }))

  /** Playground/test data for combo experimentation. */
  .get("/playground", (c) => c.json({
    availableProviders: [
      "openai",
      "anthropic",
      "google",
      "mistral",
      "cohere",
      "groq",
      "xai",
    ],
    testModels: {
      openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
      anthropic: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
      google: ["gemini-1.5-pro", "gemini-1.5-flash"],
    },
    defaultSettings: {
      strategy: "cost-optimized",
      timeoutMs: 30000,
      maxRetries: 3,
      enableFallback: true,
    },
    samplePrompt: "Explain quantum computing in simple terms.",
  }));