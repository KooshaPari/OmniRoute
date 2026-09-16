/**
 * Provider routing performance benchmarks (F-03).
 *
 * Measures pure-computation routing overhead for the top 5 providers
 * (OpenAI, Anthropic, Google, Groq, Together) with NO external HTTP calls.
 *
 * Categories benchmarked:
 *   1. Provider registry lookup (getRegistryEntry)
 *   2. Alias resolution (resolveProviderAlias, resolveProviderId)
 *   3. Provider metadata queries (category, local detection, live catalog)
 *   4. Request defaults application (applyProviderRequestDefaults)
 *   5. Cooldown tracker hot-path (isProviderInCooldown)
 *   6. Full routing pipeline (lookup + defaults + cooldown in sequence)
 *
 * Run:
 *   npx vitest bench tests/performance/provider-routing.bench.ts
 *   npx vitest bench tests/performance/provider-routing.bench.ts --reporter=verbose
 */

import { describe, bench, beforeAll } from "vitest";

// ── Provider Registry ────────────────────────────────────────────────────────
import {
  getRegistryEntry,
  getRegisteredProviders,
  getProviderCategory,
  isLocalProvider,
  providerUsesAuthoritativeLiveCatalog,
  getUnsupportedParams,
  getPassthroughProviders,
} from "@omniroute/open-sse/config/providerRegistry";

// ── Alias Resolution ─────────────────────────────────────────────────────────
import { resolveProviderAlias } from "@omniroute/open-sse/config/providerAlias";

// ── Provider Resolution (constants layer) ────────────────────────────────────
import { resolveProviderId } from "@/shared/constants/providers";

// ── Request Defaults ─────────────────────────────────────────────────────────
import {
  applyProviderRequestDefaults,
  type ProviderRequestDefaults,
} from "@omniroute/open-sse/services/providerRequestDefaults";

// ── Cooldown Tracker ─────────────────────────────────────────────────────────
import {
  isProviderInCooldown,
  recordProviderCooldown,
  clearCooldownState,
  recordProviderSuccess,
} from "@omniroute/open-sse/services/providerCooldownTracker";

// ── Top 5 providers by usage volume ──────────────────────────────────────────
const TOP_PROVIDERS = ["openai", "anthropic", "google", "groq", "together"] as const;

// ── Additional providers for scatter tests ───────────────────────────────────
const EXTRA_PROVIDERS = [
  "mistral",
  "fireworks",
  "deepseek",
  "xai",
  "cerebras",
  "nvidia",
  "together",
  "bedrock",
  "vertex",
  "openrouter",
];

// ── Pre-built test payloads ──────────────────────────────────────────────────
const BODY_MINIMAL = { model: "gpt-4", messages: [{ role: "user", content: "hi" }] };
const BODY_NO_MAX_TOKENS = {
  model: "gpt-4",
  messages: [{ role: "user", content: "hello" }],
  temperature: 0.7,
};
const BODY_FULL = {
  model: "claude-sonnet-4",
  max_tokens: 4096,
  temperature: 0.5,
  messages: [{ role: "user", content: "test" }],
};
const BODY_THINKING = {
  model: "o3",
  messages: [{ role: "user", content: "reason" }],
};

const DEFAULTS_GPT: ProviderRequestDefaults = {
  maxTokens: 4096,
  temperature: 0.7,
};

const DEFAULTS_ANTHROPIC: ProviderRequestDefaults = {
  maxTokens: 8192,
  temperature: 1.0,
  thinkingBudgetTokens: 10000,
};

// ── 1. Provider Registry Lookup ──────────────────────────────────────────────

describe("1. Provider Registry Lookup", () => {
  beforeAll(() => {
    const count = getRegisteredProviders().length;
    if (count === 0) throw new Error("No providers registered");
  });

  for (const provider of TOP_PROVIDERS) {
    bench(`getRegistryEntry("${provider}")`, () => {
      getRegistryEntry(provider);
    });
  }

  bench("getRegistryEntry (miss path)", () => {
    getRegistryEntry("nonexistent_provider_xyz");
  });

  bench("getRegisteredProviders() — full enumeration", () => {
    const all = getRegisteredProviders();
    // Simulate what combo routing does: touch each entry
    for (const id of all) {
      getRegistryEntry(id);
    }
  });

  bench("getPassthroughProviders() — Set construction", () => {
    getPassthroughProviders();
  });
});

// ── 2. Alias Resolution ──────────────────────────────────────────────────────

describe("2. Alias Resolution", () => {
  for (const provider of TOP_PROVIDERS) {
    bench(`resolveProviderAlias("${provider}")`, () => {
      resolveProviderAlias(provider);
    });
  }

  bench("resolveProviderAlias (unknown)", () => {
    resolveProviderAlias("totally_unknown_alias");
  });

  bench("resolveProviderId (constants layer)", () => {
    for (const p of TOP_PROVIDERS) {
      resolveProviderId(p);
    }
  });

  bench("resolveProviderId (with prefix model)", () => {
    resolveProviderId("openai/gpt-4");
    resolveProviderId("anthropic/claude-sonnet-4");
    resolveProviderId("google/gemini-2.5-pro");
  });
});

// ── 3. Provider Metadata Queries ─────────────────────────────────────────────

describe("3. Provider Metadata Queries", () => {
  bench("getProviderCategory (all top 5)", () => {
    for (const p of TOP_PROVIDERS) {
      getProviderCategory(p);
    }
  });

  bench("isLocalProvider (all top 5)", () => {
    for (const p of TOP_PROVIDERS) {
      const entry = getRegistryEntry(p);
      isLocalProvider(entry?.baseUrl);
    }
  });

  bench("providerUsesAuthoritativeLiveCatalog (all top 5)", () => {
    for (const p of TOP_PROVIDERS) {
      providerUsesAuthoritativeLiveCatalog(p);
    }
  });

  bench("getUnsupportedParams (mixed models)", () => {
    getUnsupportedParams("openai", "gpt-4");
    getUnsupportedParams("anthropic", "claude-sonnet-4");
    getUnsupportedParams("google", "gemini-2.5-pro");
    getUnsupportedParams("groq", "llama-3-70b");
    getUnsupportedParams("together", "meta-llama/Llama-3-70b");
  });

  bench("getUnsupportedParams (prefixed model ID)", () => {
    getUnsupportedParams("openai", "openai/o3");
    getUnsupportedParams("anthropic", "anthropic/claude-sonnet-4");
  });

  bench("Registry entry field access (format, baseUrls)", () => {
    for (const p of TOP_PROVIDERS) {
      const entry = getRegistryEntry(p);
      if (entry) {
        void entry.format;
        void entry.baseUrls;
        void entry.baseUrl;
        void entry.models;
      }
    }
  });
});

// ── 4. Request Defaults Application ──────────────────────────────────────────

describe("4. Request Defaults Application", () => {
  bench("applyProviderRequestDefaults (no-op: body already complete)", () => {
    applyProviderRequestDefaults(BODY_FULL, DEFAULTS_GPT);
  });

  bench("applyProviderRequestDefaults (fill max_tokens)", () => {
    applyProviderRequestDefaults(BODY_MINIMAL, DEFAULTS_GPT);
  });

  bench("applyProviderRequestDefaults (fill temperature)", () => {
    applyProviderRequestDefaults(BODY_NO_MAX_TOKENS, DEFAULTS_GPT);
  });

  bench("applyProviderRequestDefaults (thinking budget)", () => {
    applyProviderRequestDefaults(BODY_THINKING, DEFAULTS_ANTHROPIC);
  });

  bench("applyProviderRequestDefaults (null defaults)", () => {
    applyProviderRequestDefaults(BODY_FULL, null);
  });

  bench("applyProviderRequestDefaults (non-record body)", () => {
    applyProviderRequestDefaults("string body", DEFAULTS_GPT);
  });
});

// ── 5. Cooldown Tracker Hot-Path ─────────────────────────────────────────────

describe("5. Cooldown Tracker Hot-Path", () => {
  beforeAll(() => {
    clearCooldownState();
    // Seed some cooldown entries for the top providers
    for (const p of TOP_PROVIDERS) {
      recordProviderCooldown(p, undefined);
      recordProviderCooldown(p, "conn_a");
      recordProviderCooldown(p, "conn_b");
    }
  });

  bench("isProviderInCooldown (provider-level, no cooldown)", () => {
    // All seeded providers had 1 failure — below threshold, so not cooling
    for (const p of TOP_PROVIDERS) {
      isProviderInCooldown(p, undefined);
    }
  });

  bench("isProviderInCooldown (connection-level)", () => {
    for (const p of TOP_PROVIDERS) {
      isProviderInCooldown(p, "conn_a");
    }
  });

  bench("isProviderInCooldown (unknown provider)", () => {
    isProviderInCooldown("nonexistent", undefined);
  });

  bench("isProviderInCooldown (mixed: known + unknown)", () => {
    isProviderInCooldown("openai", "conn_a");
    isProviderInCooldown("nonexistent", undefined);
    isProviderInCooldown("anthropic", undefined);
    isProviderInCooldown("also_nonexistent", "conn_x");
  });

  // Benchmark the record→check→success cycle
  bench("record + check + success lifecycle", () => {
    clearCooldownState();
    recordProviderCooldown("openai", "bench_conn");
    isProviderInCooldown("openai", "bench_conn");
    recordProviderSuccess("openai", "bench_conn");
    clearCooldownState();
  });
});

// ── 6. Full Routing Pipeline (Sequential) ────────────────────────────────────

describe("6. Full Routing Pipeline", () => {
  bench("route resolution → defaults → cooldown (per provider)", () => {
    for (const p of TOP_PROVIDERS) {
      // 1. Resolve alias
      const resolved = resolveProviderAlias(p);

      // 2. Look up registry entry
      const entry = getRegistryEntry(resolved);

      // 3. Check metadata
      if (entry) {
        void entry.format;
        void entry.baseUrls;
        getProviderCategory(resolved);
        isLocalProvider(entry.baseUrl);
        providerUsesAuthoritativeLiveCatalog(resolved);
      }

      // 4. Apply request defaults
      applyProviderRequestDefaults({ ...BODY_MINIMAL, model: "gpt-4" }, DEFAULTS_GPT);

      // 5. Check cooldown
      isProviderInCooldown(resolved, undefined);
    }
  });

  bench("combo routing candidate evaluation (10 random)", () => {
    const allProviders = getRegisteredProviders();
    // Simulate combo routing: pick 10 random candidates and evaluate
    for (let i = 0; i < 10; i++) {
      const idx = (i * 37 + 11) % allProviders.length;
      const p = allProviders[idx];
      const entry = getRegistryEntry(p);
      if (entry) {
        void entry.format;
        void entry.baseUrls;
        void entry.models;
        getProviderCategory(p);
        isProviderInCooldown(p, undefined);
      }
    }
  });

  bench("unsupported params check (5 models)", () => {
    const models = [
      { provider: "openai", model: "gpt-4" },
      { provider: "anthropic", model: "claude-sonnet-4" },
      { provider: "google", model: "gemini-2.5-pro" },
      { provider: "groq", model: "llama-3-70b" },
      { provider: "together", model: "meta-llama/Llama-3-70b" },
    ];
    for (const { provider, model } of models) {
      getUnsupportedParams(provider, model);
    }
  });
});
