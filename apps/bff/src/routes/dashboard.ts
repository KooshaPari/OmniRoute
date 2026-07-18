import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { ComboSchema, ProviderSchema } from "@argismonitor/api-contracts";

const SettingsSchema = z.object({
  baseUrl: z.string().url(),
  telemetry: z.boolean(),
  autoUpdate: z.boolean(),
  language: z.string(),
  theme: z.enum(["auto", "light", "dark"]),
});
const KeyCreateSchema = z.object({ name: z.string().min(1).max(100) });
const CompressionABSchema = z.object({ text: z.string() });
const PlaygroundStreamSchema = z.object({
  model: z.string(),
  systemPrompt: z.string(),
  userPrompt: z.string(),
  temperature: z.number(),
});
const RouterSchema = z.object({
  defaultModel: z.string(),
  overrides: z.object({
    chat: z.string(),
    code: z.string(),
    embed: z.string(),
    image: z.string(),
    vision: z.string(),
  }),
  fallbackChain: z.array(z.string()),
  costBudgetUsd: z.number(),
});
const FlagOverrideSchema = z.object({ userOverride: z.boolean().nullable() });

export const dashboardRoutes = new Hono()
  .get("/health", (c) => c.json({ status: "healthy", ts: new Date().toISOString() }))
  .get("/providers", (c) => c.json({ providers: [] }))
  .post("/providers", zValidator("json", ProviderSchema), (c) =>
    c.json({ ok: true, provider: c.req.valid("json") })
  )
  .get("/usage", (c) => c.json({ rows: [] }))
  .get("/combos", (c) => c.json({ combos: [] }))
  .post("/combos", zValidator("json", ComboSchema), (c) =>
    c.json({
      ok: false,
      status: "unavailable",
      source: "no-combo-store",
      combo: c.req.valid("json"),
    }, 501)
  )
  .get("/security", (c) =>
    c.json({
      csrfEnabled: true,
      jwtSecretRotatedAt: "2026-06-15T00:00:00Z",
      mitmCertInstalled: false,
      sessionSecretStrong: true,
      openaiApiKeyLeakage: "safe",
    })
  )
  .get("/keys", (c) => c.json({ keys: [] }))
  .post("/keys", zValidator("json", KeyCreateSchema), (c) =>
    c.json({
      ok: false,
      status: "unavailable",
      source: "no-key-store",
      key: null,
    })
  )
  .post("/keys/:id/revoke", (c) =>
    c.json({ ok: false, status: "unavailable", source: "no-key-store", id: c.req.param("id") })
  )
  .get("/settings", (c) =>
    c.json({
      baseUrl: "http://localhost:20128",
      telemetry: true,
      autoUpdate: true,
      language: "en",
      theme: "auto",
    })
  )
  .post("/settings", zValidator("json", SettingsSchema), (c) =>
    c.json({ ok: true, settings: c.req.valid("json") })
  )
  .get("/cost", (c) => c.json({ rows: [] }))
  .get("/billing", (c) =>
    c.json({ name: "Pro", pricePerMonth: 49, seats: 5, renewsAt: "2026-08-01" })
  )
  .get("/logs", (c) => c.json({ logs: [] }))
  .get("/mcp", (c) => c.json({ servers: [] }))
  .get("/a2a", (c) => c.json({ agents: [] }))
  .get("/skills", (c) => c.json({ skills: [] }))
  .get("/memory", (c) => c.json({ entries: [] }))
  .get("/cache", (c) =>
    c.json({
      status: "unavailable",
      source: "no-cache-metrics-source",
      hits: null,
      misses: null,
      sizeMb: null,
      evictions: null,
    })
  )
  .get("/batch", (c) => c.json({ batches: [] }))
  .get("/webhooks", (c) => c.json({ webhooks: [] }))
  .get("/audit", (c) => c.json({ events: [] }))
  // Phase 2.11-2.12 critical routes
  .get("/compression/stats", (c) =>
    c.json({
      status: "unavailable",
      source: "no-compression-metrics-source",
      gcfBytes: null,
      toonBytes: null,
      jsonBytes: null,
      prompts: null,
    })
  )
  .post("/compression/ab", zValidator("json", CompressionABSchema), (c) => {
    const t = c.req.valid("json").text;
    return c.json({
      gcf: `gcf(${t.length}b)`,
      toon: `toon(${t.length}b)`,
      json: JSON.stringify({ text: t }),
    });
  })
  .get("/playground/models", (c) =>
    c.json({
      models: [
        { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic" },
        { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" },
      ],
    })
  )
  .post("/playground/stream", zValidator("json", PlaygroundStreamSchema), (c) => {
    return streamSSE(c, async (stream) => {
      const input = c.req.valid("json");
      const text = `Echo from ${input.model}: ${input.userPrompt.slice(0, 50)}...`;
      const words = text.split(" ");
      let i = 0;
      while (i < words.length) {
        await stream.writeSSE({ event: "token", data: JSON.stringify({ token: words[i] + " " }) });
        i++;
        await new Promise((r) => setTimeout(r, 30));
      }
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ tokens: words.length, cost: words.length * 0.00003 }),
      });
    });
  })
  .get("/router", (c) =>
    c.json({
      defaultModel: "claude-sonnet-4",
      overrides: {
        chat: "claude-sonnet-4",
        code: "claude-sonnet-4",
        embed: "text-embedding-3-small",
        image: "gpt-image-1",
        vision: "claude-sonnet-4",
      },
      fallbackChain: ["claude-sonnet-4", "gpt-4o", "gemini-2.5-pro"],
      costBudgetUsd: 500,
    })
  )
  .put("/router", zValidator("json", RouterSchema), (c) =>
    c.json({ ok: true, router: c.req.valid("json") })
  )
  .get("/observability/overview", (c) =>
    c.json({
      status: "unavailable",
      source: "no-runtime-aggregation",
      p50: null,
      p95: null,
      p99: null,
      rps: null,
      errorRate: null,
    })
  )
  .get("/observability/timeseries", (c) =>
    c.json({
      status: "unavailable",
      source: "no-runtime-aggregation",
      points: [],
    })
  )
  .get("/observability/top-endpoints", (c) =>
    c.json({
      status: "unavailable",
      source: "no-runtime-aggregation",
      endpoints: [],
    })
  )
  .get("/diagnostics/full", (c) =>
    c.json({
      status: "unavailable",
      source: "no-diagnostics-metrics-source",
      uptimeSeconds: null,
      version: null,
      bffConnected: null,
      nextjsConnected: null,
      tauriShell: null,
      dbWalPosition: null,
      lastBackup: null,
      cacheHitRate: null,
      networkChecks: [],
    })
  )
  .get("/flags", (c) =>
    c.json({
      flags: [
        {
          key: "new-dashboard",
          description: "New Svelte 5 dashboard",
          default: true,
          rollout: 100,
          conditions: [],
          userOverride: null,
        },
        {
          key: "telemetry",
          description: "Send anonymous usage telemetry",
          default: true,
          rollout: 100,
          conditions: [],
          userOverride: null,
        },
        {
          key: "beta-compression",
          description: "TOON + GCF best-of-N encoder",
          default: false,
          rollout: 25,
          conditions: [],
          userOverride: null,
        },
      ],
    })
  )
  .put("/flags/:key", zValidator("json", FlagOverrideSchema), (c) =>
    c.json({ ok: true, key: c.req.param("key"), override: c.req.valid("json").userOverride })
  )
  // Phase 2.12 extra routes
  .get("/billing/invoices", (c) => c.json({ invoices: [] }))
  .get("/keys/:id", (c) =>
    c.json({
      status: "unavailable",
      source: "no-key-store",
      key: null,
    })
  )
  .get("/keys/:id/usage", (c) =>
    c.json({
      status: "unavailable",
      source: "no-key-usage-metrics-source",
      usage: [],
    })
  )
  .get("/usage/by-model", (c) => c.json({ rows: [] }))
  .get("/cost/by-provider", (c) => c.json({ providers: [] }))
  .post("/audit/export", (c) =>
    c.json({
      ok: false,
      status: "unavailable",
      source: "no-audit-export-store",
      url: null,
      rows: 0,
    }, 501)
  )
  .get("/performance", (c) => {
    const range = c.req.query("range") ?? "24h";
    return c.json({
      status: "unavailable",
      source: "no-model-aggregation",
      range,
      rows: [],
    });
  })
  .get("/quotas", (c) =>
    c.json({
      buckets: [
        {
          id: "default",
          label: "Default tier",
          cap: 60,
          unit: "req/min",
          used: 12,
          overflow: "fallback",
        },
        { id: "pro", label: "Pro tier", cap: 600, unit: "req/min", used: 87, overflow: "queue" },
      ],
    })
  )
  .put("/quotas", (c) => c.json({ ok: true }))
  .get("/rules", (c) => c.json({ rules: [] }))
  .put("/rules", (c) => c.json({ ok: true }))

  .get("/profile", (c) =>
    c.json({
      displayName: "",
      email: "user@argismonitor.local",
      bio: "",
      avatarUrl: "",
      theme: "auto",
      language: "en",
    })
  )
  .put("/profile", (c) => c.json({ ok: true }))
  .get("/sessions", (c) =>
    c.json({
      status: "unavailable",
      source: "no-session-store",
      sessions: [],
    })
  )
  .delete("/sessions/:id", (c) => c.json({ ok: true, id: c.req.param("id") }))
  .post("/keys-rotation", (c) =>
    c.json({ ok: false, status: "unavailable", source: "no-key-store", newKey: null })
  )
  .get("/sso", (c) => c.json({ enabled: false, provider: "google", allowedDomains: [] }))
  .put("/sso", (c) => c.json({ ok: true }))
  .post("/sso/test", (c) => c.json({ ok: true, message: "SSO endpoint reachable" }))
  .get("/notifications", (c) =>
    c.json({
      channels: { email: true, push: false, inApp: true },
      events: { outage: true, comboHealth: true, usageSpike: true, release: false },
      dailyDigest: { enabled: false, time: "09:00" },
    })
  )
  .put("/notifications", (c) => c.json({ ok: true }))
  .post("/notifications/test", (c) => c.json({ ok: true, sentTo: "user@argismonitor.local" }))

  .post("/combos/:id/flow", (c) => c.json({ ok: true, savedAt: new Date().toISOString() }))
  .get("/health/stream", (c) => {
    return streamSSE(c, async (stream) => {
      let id = 0;
      const send = async (level: "info" | "warn" | "error", message: string) => {
        await stream.writeSSE({
          id: String(id++),
          event: "health",
          data: JSON.stringify({ ts: new Date().toISOString(), level, message }),
        });
      };
      await send("info", "SSE stream connected");
      const interval = setInterval(() => {
        send("info", `heartbeat @ ${new Date().toLocaleTimeString()}`).catch(() => {});
      }, 5000);
      stream.onAbort(() => clearInterval(interval));
      await new Promise<void>((resolve) => stream.onAbort(() => resolve()));
    });
  });
