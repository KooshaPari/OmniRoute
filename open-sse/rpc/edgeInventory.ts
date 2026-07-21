/**
 * Production-rolling edge inventory (ADR-032 / Option C).
 *
 * Single source-of-truth for the 17+ dispatch edges wired into the
 * running system. Each row carries:
 *   - `name`          the stable identifier used by `setEdgeTier` / `getEdgeTier`
 *   - `defaultTier`   the resolver's starting tier
 *   - `providerScope` the cascading kill-switch scope (Appendix C)
 *   - `crate`         the FFI crate backing the T3 path (null = TS only)
 *   - `symbol`        the FFI symbol name (null = no FFI surface)
 *   - `udsMethod`     the JSON-RPC method on the UDS server (null = no T2)
 *   - `httpPath`      the HTTP loopback path (null = no T1 — rare)
 *   - `hotPathFiles`  the production callsites using `useDispatchForEdge`
 *
 * Keep this list in sync with `open-sse/rpc/edges/*.ts`. CI verifies that
 * every name listed here has a corresponding `registerEdge` call in the
 * codebase; missing edges fail the build via `dispatch-edges-registry.test.ts`.
 */

export interface EdgeInventoryRow {
  name: string;
  defaultTier: "T1" | "T2" | "T3";
  providerScope: readonly string[] | null;
  crate: string | null;
  symbol: string | null;
  udsMethod: string | null;
  httpPath: string | null;
  hotPathFiles: readonly string[];
  owner: string;
}

export const EDGE_INVENTORY: readonly EdgeInventoryRow[] = [
  {
    name: "scoring.combo.scoreSimd",
    defaultTier: "T3",
    providerScope: null,
    crate: "omniroute_ffi_combo_scorer",
    symbol: "score_combo_simd",
    udsMethod: "scoring.scoreSimd",
    httpPath: "/v1/edges/scoring/scoreSimd",
    hotPathFiles: ["open-sse/services/autoCombo/scoring.ts", "open-sse/services/combo.ts"],
    owner: "@KooshaPari/routing",
  },
  {
    name: "sse.chunk.sseStream",
    defaultTier: "T3",
    providerScope: null,
    crate: "omniroute_ffi_sse_chunking",
    symbol: "sse_chunk_sse_stream",
    udsMethod: "sse.chunk",
    httpPath: "/v1/edges/sse/chunk",
    hotPathFiles: ["open-sse/handlers/chatCore.ts"],
    owner: "@KooshaPari/streaming",
  },
  {
    name: "cache.semantic.lookup",
    defaultTier: "T3",
    providerScope: null,
    crate: "omniroute_ffi_signature_cache",
    symbol: "semantic_lookup_v2_simd",
    udsMethod: "cache.semanticLookup",
    httpPath: "/v1/edges/cache/semantic",
    hotPathFiles: ["open-sse/services/signatureCache.ts"],
    owner: "@KooshaPari/caching",
  },
  {
    name: "guardrails.pii.anonymize",
    defaultTier: "T3",
    providerScope: ["*"],
    crate: "omniroute_ffi_guardrails_pii",
    symbol: "guardrails_pii_detect",
    udsMethod: "guardrails.pii.anonymize",
    httpPath: "/v1/edges/guardrails/pii",
    hotPathFiles: ["src/lib/guardrails/piiMasker.ts", "open-sse/handlers/chatCore.ts"],
    owner: "@KooshaPari/safety",
  },
  {
    name: "guardrails.prompt.injection",
    defaultTier: "T2",
    providerScope: ["*"],
    crate: null,
    symbol: null,
    udsMethod: "guardrails.promptInjection",
    httpPath: "/v1/edges/guardrails/prompt-injection",
    hotPathFiles: ["src/lib/guardrails/promptInjection.ts"],
    owner: "@KooshaPari/safety",
  },
  {
    name: "compression.lite.collapseWhitespace",
    defaultTier: "T2",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: "compression.collapseWhitespace",
    httpPath: "/v1/edges/compression/collapse-whitespace",
    hotPathFiles: ["open-sse/services/compression/lite.ts"],
    owner: "@KooshaPari/cost",
  },
  {
    name: "compression.lite.compressToolResults",
    defaultTier: "T2",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: "compression.compressToolResults",
    httpPath: "/v1/edges/compression/tool-results",
    hotPathFiles: ["open-sse/services/compression/lite.ts"],
    owner: "@KooshaPari/cost",
  },
  {
    name: "compression.lite.dedupSystemPrompt",
    defaultTier: "T2",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: "compression.dedupSystemPrompt",
    httpPath: "/v1/edges/compression/dedup-system",
    hotPathFiles: ["open-sse/services/compression/lite.ts"],
    owner: "@KooshaPari/cost",
  },
  {
    name: "compression.lite.removeRedundantContent",
    defaultTier: "T2",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: "compression.removeRedundantContent",
    httpPath: "/v1/edges/compression/redundant",
    hotPathFiles: ["open-sse/services/compression/lite.ts"],
    owner: "@KooshaPari/cost",
  },
  {
    name: "rateLimit.tokenBucket.consume",
    defaultTier: "T3",
    providerScope: null,
    crate: "omniroute_ffi_token_bucket",
    symbol: "consume_tokens",
    udsMethod: "rateLimit.consume",
    httpPath: "/v1/edges/rate-limit/consume",
    hotPathFiles: ["open-sse/services/rateLimitManager.ts"],
    owner: "@KooshaPari/resilience",
  },
  {
    name: "usage.sync",
    defaultTier: "T2",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: "usage.sync",
    httpPath: "/v1/edges/usage/sync",
    hotPathFiles: ["open-sse/services/usage.ts"],
    owner: "@KooshaPari/billing",
  },
  {
    name: "pricing.sync",
    defaultTier: "T1",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: null,
    httpPath: "/v1/edges/pricing/sync",
    hotPathFiles: ["src/lib/pricingSync.ts"],
    owner: "@KooshaPari/billing",
  },
  {
    name: "webhook.dispatch",
    defaultTier: "T2",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: "webhook.dispatch",
    httpPath: "/v1/edges/webhook/dispatch",
    hotPathFiles: ["src/lib/webhookDispatcher.ts"],
    owner: "@KooshaPari/integrations",
  },
  {
    name: "metrics.render",
    defaultTier: "T1",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: null,
    httpPath: "/metrics",
    hotPathFiles: ["open-sse/rpc/metricsRoute.ts"],
    owner: "@KooshaPari/observability",
  },
  {
    name: "scheduler.tick",
    defaultTier: "T2",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: "scheduler.tick",
    httpPath: "/v1/edges/scheduler/tick",
    hotPathFiles: ["open-sse/rpc/reconciler.ts"],
    owner: "@KooshaPari/scheduling",
  },
  {
    name: "config.reload",
    defaultTier: "T1",
    providerScope: null,
    crate: null,
    symbol: null,
    udsMethod: null,
    httpPath: "/v1/edges/config/reload",
    hotPathFiles: ["src/lib/config"],
    owner: "@KooshaPari/config",
  },
  {
    name: "bifrost.chat",
    defaultTier: "T1",
    providerScope: null,
    crate: "omniroute_ffi_bifrost_bridge",
    symbol: "bifrost_chat",
    udsMethod: "bifrost.chat",
    httpPath: "/v1/edges/bifrost/chat",
    hotPathFiles: ["open-sse/executors/bifrost.ts"],
    owner: "@KooshaPari/bifrost",
  },
];

export const FFI_CRATES: readonly string[] = [
  "omniroute_ffi_combo_scorer",
  "omniroute_ffi_signature_cache",
  "omniroute_ffi_sse_chunking",
  "omniroute_ffi_guardrails_pii",
  "omniroute_ffi_token_bucket",
  "omniroute_ffi_bifrost_bridge",
];
