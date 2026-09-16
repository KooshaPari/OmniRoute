#!/usr/bin/env node
/**
 * provider-routing.bench.ts — Provider routing overhead benchmarks (F-03)
 *
 * Measures pure-computation routing overhead for the top 5 providers
 * (OpenAI, Anthropic, Google, Groq, Together) with NO external HTTP calls.
 *
 * Categories benchmarked:
 *   1. Provider registry lookup
 *   2. Alias resolution
 *   3. Provider metadata queries (category, local detection)
 *   4. Request defaults application
 *   5. Cooldown tracker hot-path
 *   6. Full routing pipeline (lookup + defaults + cooldown in sequence)
 *
 * Usage:
 *   npx tsx benches/dispatch/provider-routing.bench.ts
 */

import { bench, type BenchResult } from "./shared.ts";

// ── Imports from open-sse ────────────────────────────────────────────────────
import {
  getRegistryEntry,
  getProviderCategory,
  isLocalProvider,
  providerUsesAuthoritativeLiveCatalog,
} from "../../open-sse/config/providerRegistry.ts";
import { resolveProviderAlias } from "../../open-sse/config/providerAlias.ts";
import {
  applyProviderRequestDefaults,
} from "../../open-sse/services/providerRequestDefaults.ts";
import {
  isProviderInCooldown,
  recordProviderCooldown,
  clearCooldownState,
} from "../../open-sse/services/providerCooldownTracker.ts";

// ── Top 5 providers by usage volume ──────────────────────────────────────────
const TOP_PROVIDERS = ["openai", "anthropic", "google", "groq", "together"] as const;

// ── Pre-built test payloads ──────────────────────────────────────────────────
const BODY_MINIMAL = { model: "gpt-4", messages: [{ role: "user", content: "hi" }] };
const BODY_FULL = {
  model: "claude-sonnet-4",
  max_tokens: 4096,
  temperature: 0.5,
  top_p: 0.9,
  messages: [{ role: "user", content: "hello world" }],
};

// ── Alias pairs for resolution testing ───────────────────────────────────────
const ALIAS_PAIRS: Array<[string, string]> = [
  ["gpt-4o", "openai"],
  ["claude-3-5-sonnet", "anthropic"],
  ["gemini-pro", "google"],
  ["llama-3-70b", "groq"],
  ["mistral-large", "mistral"],
  ["command-r-plus", "cohere"],
];

// ── Benchmark: Provider Registry Lookup ──────────────────────────────────────
async function benchRegistryLookup(): Promise<BenchResult> {
  return bench({
    name: "provider-registry-lookup",
    tier: "T2",
    edge: "routing",
    description:
      "getRegistryEntry() for each of the top 5 providers - pure map lookup",
    iterations: 50_000,
    run: () => {
      for (const p of TOP_PROVIDERS) {
        getRegistryEntry(p);
      }
    },
  });
}

// ── Benchmark: Alias Resolution ──────────────────────────────────────────────
async function benchAliasResolution(): Promise<BenchResult> {
  return bench({
    name: "alias-resolution",
    tier: "T2",
    edge: "routing",
    description:
      "resolveProviderAlias() for 6 common model-name aliases",
    iterations: 30_000,
    run: () => {
      for (const [alias] of ALIAS_PAIRS) {
        resolveProviderAlias(alias);
      }
    },
  });
}

// ── Benchmark: Provider Metadata Queries ─────────────────────────────────────
async function benchMetadataQueries(): Promise<BenchResult> {
  return bench({
    name: "provider-metadata-queries",
    tier: "T2",
    edge: "routing",
    description:
      "getProviderCategory() + isLocalProvider() + authoritativeness check for top 5",
    iterations: 40_000,
    run: () => {
      for (const p of TOP_PROVIDERS) {
        getProviderCategory(p);
        isLocalProvider(p);
        providerUsesAuthoritativeLiveCatalog(p);
      }
    },
  });
}

// ── Benchmark: Request Defaults ──────────────────────────────────────────────
async function benchRequestDefaults(): Promise<BenchResult> {
  return bench({
    name: "request-defaults",
    tier: "T2",
    edge: "routing",
    description:
      "applyProviderRequestDefaults() for a minimal and full request body",
    iterations: 20_000,
    run: () => {
      for (const p of TOP_PROVIDERS) {
        applyProviderRequestDefaults(p, { ...BODY_MINIMAL });
        applyProviderRequestDefaults(p, { ...BODY_FULL });
      }
    },
  });
}

// ── Benchmark: Cooldown Tracker Hot-Path ─────────────────────────────────────
async function benchCooldownTracker(): Promise<BenchResult> {
  clearCooldownState();
  for (const p of TOP_PROVIDERS) {
    recordProviderCooldown(p, 60_000);
  }

  return bench({
    name: "cooldown-tracker",
    tier: "T2",
    edge: "routing",
    description:
      "isProviderInCooldown() for top 5 providers (all in cooldown state)",
    iterations: 50_000,
    run: () => {
      for (const p of TOP_PROVIDERS) {
        isProviderInCooldown(p);
      }
    },
  });
}

// ── Benchmark: Full Routing Pipeline ─────────────────────────────────────────
async function benchFullPipeline(): Promise<BenchResult> {
  clearCooldownState();

  return bench({
    name: "full-routing-pipeline",
    tier: "T2",
    edge: "routing",
    description:
      "registry lookup + metadata + defaults + cooldown check in sequence (per-provider loop)",
    iterations: 10_000,
    run: () => {
      for (const p of TOP_PROVIDERS) {
        const entry = getRegistryEntry(p);
        if (!entry) continue;
        const cat = getProviderCategory(p);
        const isLocal = isLocalProvider(p);
        const body = applyProviderRequestDefaults(p, { ...BODY_MINIMAL });
        const cooled = isProviderInCooldown(p);
        void entry;
        void cat;
        void isLocal;
        void body;
        void cooled;
      }
    },
  });
}

// ── Runner ───────────────────────────────────────────────────────────────────
async function main() {
  const results: BenchResult[] = [];

  results.push(await benchRegistryLookup());
  results.push(await benchAliasResolution());
  results.push(await benchMetadataQueries());
  results.push(await benchRequestDefaults());
  results.push(await benchCooldownTracker());
  results.push(await benchFullPipeline());

  for (const r of results) {
    const line = JSON.stringify({
      bench: r.name,
      tier: r.tier,
      edge: r.edge,
      description: r.description,
      iterations: r.iterations,
      totalMs: +r.totalMs.toFixed(2),
      meanMicros: +r.meanMicros.toFixed(2),
      minMicros: +r.minMicros.toFixed(2),
      maxMicros: +r.maxMicros.toFixed(2),
      p50Micros: +r.p50Micros.toFixed(2),
      p95Micros: +r.p95Micros.toFixed(2),
      p99Micros: +r.p99Micros.toFixed(2),
    });
    process.stdout.write(line + "\n");
  }

  process.stderr.write("\n-- Provider Routing Benchmarks (F-03) --\n");
  process.stderr.write(
    "| Benchmark                         | Mean (us) | p50 (us)  | p95 (us)  | Iterations |\n"
  );
  process.stderr.write(
    "|-----------------------------------|-----------|-----------|-----------|------------|\n"
  );
  for (const r of results) {
    process.stderr.write(
      `| ${r.name.padEnd(33)} | ${r.meanMicros.toFixed(1).padStart(9)} | ${r.p50Micros.toFixed(1).padStart(9)} | ${r.p95Micros.toFixed(1).padStart(9)} | ${r.iterations.toLocaleString().padStart(10)} |\n`
    );
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err}\n`);
  process.exit(1);
});
