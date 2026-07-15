/**
 * Combo Configuration Resolver
 *
 * Implements 3-layer cascade: Global Defaults → Provider Overrides → Per-Combo Config
 * Most specific wins.
 */

<<<<<<< Updated upstream
import { MAX_TIMER_TIMEOUT_MS } from "../../src/shared/utils/runtimeTimeouts.ts";
import type { ResponseValidationConfig } from "./combo/responseValidation.ts";

/**
 * Maximum number of concurrent pre-screen checks (provider profile + availability)
 * when running parallel pre-screening for priority strategy combos.
 */
export const PRE_SCREEN_CONCURRENCY = 5;

/**
 * Default per-target timeout for combo fallback when a combo does not set its own
 * `targetTimeoutMs`. Combos exist to fail over fast, so inheriting the full upstream
 * request timeout (FETCH_TIMEOUT_MS, 600s by default) made a single hung target stall
 * the whole combo for up to 10 minutes before falling through to the next model
 * (escalated cmqlrhd7c). For STREAMING requests this only bounds the time-to-first-headers
 * — token generation streams after the response resolves, so it is NOT cut short. Operators
 * can still raise it per-combo via `targetTimeoutMs` (capped at the upstream ceiling), or set
 * a longer value for slow non-streaming reasoning combos.
 */
export const DEFAULT_COMBO_TARGET_TIMEOUT_MS = 120_000;

/**
 * Default pre-cascade semaphore queue depth for round-robin combos (#3872). When a
 * combo member's concurrency slot is saturated, this many requests wait in the
 * member's queue before `SEMAPHORE_QUEUE_FULL` triggers a cascade to the next member.
 * Kept at 20 for backward compatibility; operators wanting faster failover can lower
 * it (0 = never queue, fail over to the next member immediately).
 */
export const DEFAULT_COMBO_QUEUE_DEPTH = 20;

/** Upper bound for the configurable combo queue depth (defensive clamp). */
export const MAX_COMBO_QUEUE_DEPTH = 100;

=======
>>>>>>> Stashed changes
const DEFAULT_COMBO_CONFIG = {
  strategy: "priority",
  maxRetries: 1,
  retryDelayMs: 2000,
  concurrencyPerModel: 3, // max simultaneous requests per model (round-robin)
  queueTimeoutMs: 30000, // max wait time in semaphore queue (round-robin)
  handoffThreshold: 0.85,
  handoffModel: "",
  handoffProviders: ["codex"],
  maxMessagesForSummary: 30,
  maxComboDepth: 3,
  trackMetrics: true,
<<<<<<< Updated upstream
  reasoningTokenBufferEnabled: true,
  manifestRouting: false,
  // Complexity-aware auto routing (2026): when on, the auto router scores
  // candidates by how well their tier matches the request's classified
  // difficulty (feeds tierAffinity/specificityMatch). Opt-in — off by default.
  complexityAwareRouting: false,
  resetAwareSessionWeight: 0.35,
  resetAwareWeeklyWeight: 0.65,
  resetAwareTieBandPercent: 5,
  resetAwareExhaustionGuardPercent: 10,
  failoverBeforeRetry: true,
  // Feature 4985: configurable response-body validation predicate (per-combo). When set,
  // a 200 OK whose body fails the predicate fails over to the next target.
  responseValidation: undefined as ResponseValidationConfig | undefined,
  maxSetRetries: 0,
  setRetryDelayMs: 2000,
  // Zero-latency optimizations are opt-in because some modes can race targets or
  // mutate fallback request bodies for lower tail latency.
  zeroLatencyOptimizationsEnabled: false,
  // Hedging (Speculative Execution) defaults
  hedging: false,
  hedgeDelayMs: 500,
  // Mid-Stream Fallback Compression defaults
  fallbackCompressionMode: "lite",
  fallbackCompressionThreshold: 1000,
  // Predictive TTFT Circuit Breaker defaults
  predictiveTtftMs: 0,
  // Pipeline defaults
  pipeline_enabled: false,
  task_detection: "pattern",
  max_reflection_loops: 1,
  skip_pipeline_for_tokens_under: 50,
  pipeline_fallback: "single-provider",
  resetAwareQuotaCacheTtlMs: 0,
  resetAwareQuotaCacheMaxStaleMs: 0,
  shadowRouting: {
    enabled: false,
    targets: [],
    sampleRate: 1,
    maxTargets: 2,
    timeoutMs: 30000,
  },
  evalRouting: {
    enabled: false,
    suiteIds: [],
    maxAgeHours: 720,
    minCases: 1,
    qualityWeight: 0.85,
    latencyWeight: 0.15,
    cacheTtlMs: 60000,
  },
=======
>>>>>>> Stashed changes
};

const LEGACY_COMBO_RESILIENCE_KEYS = new Set([
  "timeoutMs",
  "healthCheckEnabled",
  "healthCheckTimeoutMs",
]);

/**
 * Resolve effective config for a combo, applying cascade:
 *   DEFAULT_COMBO_CONFIG → settings.comboDefaults → settings.providerOverrides[provider] → combo.config
 *
 * @param {Object} combo - The combo object { config, ... }
 * @param {Object} settings - App settings from localDb
 * @param {string} [provider] - Optional provider to apply provider-level overrides
 * @returns {Object} Resolved config
 */
export function resolveComboConfig(combo, settings, provider?: string | null) {
  const global = settings?.comboDefaults || {};
  const providerOverride = provider ? settings?.providerOverrides?.[provider] || {} : {};
  const comboConfig = combo?.config || {};

  // Clean undefined values before spreading
  const clean = (obj) =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([key, value]) =>
          value !== undefined && value !== null && !LEGACY_COMBO_RESILIENCE_KEYS.has(key)
      )
    );

  return {
    ...DEFAULT_COMBO_CONFIG,
    ...clean(global),
    ...clean(providerOverride),
    ...clean(comboConfig),
  };
}

/**
 * Get the default combo config (used when no overrides exist)
 */
export function getDefaultComboConfig() {
  return { ...DEFAULT_COMBO_CONFIG };
}
