/**
 * Auto-instrumentation helpers — wrap a callback in a span + record the
 * right metrics. Keeps instrumentation boilerplate out of the call site:
 *
 *   await instrumentProvider({ provider: "openai", model: "gpt-4", tier: "free" },
 *     () => callOpenAI(...));
 *
 * Each helper handles three things:
 *   1. Open / close a span with sensible defaults.
 *   2. Record the relevant metric(s) — duration, outcome, cache hit, etc.
 *   3. Capture exceptions so the span ends in ERROR status.
 *
 * Helpers are:
 *   - instrumentFetch({kind, attributes}, fn)   — HTTP fetch wrappers
 *   - instrumentDb({op, table}, fn)             — DB calls
 *   - instrumentCache({layer}, fn)              — cache lookups
 *   - instrumentProvider({provider, model, tier}, fn) — upstream calls
 *
 * All helpers tolerate telemetry being disabled (OTEL_SDK_DISABLED=true).
 * In that mode they still call `fn` exactly once and return its result —
 * no spans are allocated, no metrics are emitted, no exceptions are
 * recorded. This is the "default-off" hot-path posture.
 */

import {
  withSpan,
  recordException,
  setAttribute,
  setAttributes,
  setSpanStatus,
  endSpan,
  currentTraceId,
  currentSpanId,
} from "./otel.ts";
import type { Span, SpanKind } from "./spanTypes.ts";
import {
  httpMetricsMiddleware,
  recordProviderAttempt,
  recordCacheHit,
  recordCacheMiss,
  recordProviderDuration,
} from "./metrics.ts";
import { getLogger } from "./logger.ts";

/**
 * The set of cache layers the rest of the codebase recognizes. Used by
 * `isKnownCacheLayer()` for log/metric cardinality discipline — unknown
 * layers fall into the "other" bucket so an over-eager caller can't
 * blow up the cache_hits_total metric with custom layer names.
 */
export const KNOWN_CACHE_LAYERS = new Set<string>([
  "prompt",
  "response",
  "embedding",
  "tool-result",
  "token",
  "model-capability",
  "provider-routing",
  "usage-quota",
]);

/**
 * Test whether a string is in the known cache-layer set. Used by callers
 * that want to validate a layer name before emitting a metric so an
 * accidental "user-id" label doesn't poison the cache_hit_total series.
 */
export function isKnownCacheLayer(s: string): boolean {
  return KNOWN_CACHE_LAYERS.has(s);
}

/**
 * Wrap a fetch call in a CLIENT span + http metrics. The span name is
 * derived from `kind` (default: "http.fetch"); the attributes are the
 * caller-provided `attributes` plus any captured from the result.
 *
 * @param opts.kind       — short label for the span (e.g. "http.fetch", "http.stream")
 * @param opts.attributes — base attributes set on the span before `fn` runs
 * @param fn              — async function; receives the active span as its arg
 */
export async function instrumentFetch<T>(
  opts: { kind?: string; attributes?: Record<string, string | number | boolean> },
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const kind = opts.kind ?? "http.fetch";
  return withSpan(
    kind,
    async (span) => {
      if (opts.attributes) setAttributes(span, opts.attributes);
      const t0 = Date.now();
      try {
        const result = await fn(span);
        // If `fn` returned a fetch Response, capture status / url.
        if (isResponseLike(result)) {
          setAttribute(span, "http.status_code", result.status);
          if (result.url) setAttribute(span, "http.url", result.url);
        }
        const dur = (Date.now() - t0) / 1000;
        const route = String(opts.attributes?.["route"] ?? "unknown");
        const method = String(opts.attributes?.["http.method"] ?? "GET");
        const status = readStatusFromSpan(span);
        httpMetricsMiddleware({ route, method, status, durationSeconds: dur });
        return result;
      } catch (err) {
        const dur = (Date.now() - t0) / 1000;
        const route = String(opts.attributes?.["route"] ?? "unknown");
        const method = String(opts.attributes?.["http.method"] ?? "GET");
        httpMetricsMiddleware({ route, method, status: 0, durationSeconds: dur });
        throw err;
      }
    },
    { kind: "CLIENT" as SpanKind }
  );
}

/**
 * Wrap a DB call in an INTERNAL span. Emits `db.operation`, `db.table`,
 * `db.duration_seconds` attributes. No metrics — DB latency is recorded
 * via the proxy span's histogram when the DB call is on the request path.
 */
export async function instrumentDb<T>(
  opts: { op: string; table?: string },
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    `db.${opts.op}`,
    async (span) => {
      setAttribute(span, "db.operation", opts.op);
      if (opts.table) setAttribute(span, "db.table", opts.table);
      return fn(span);
    },
    { kind: "INTERNAL", attributes: { "db.operation": opts.op } }
  );
}

/**
 * Wrap a cache lookup in an INTERNAL span and emit hit/miss metrics.
 *
 * The wrapper inspects the resolved value (or a callback) to determine
 * hit vs miss. Two modes:
 *   1. `lookup()` returns `{ hit, value }` — caller decides
 *   2. `lookup()` returns the raw value; miss is inferred from `null/undefined`
 *
 * Mode 2 is the default; mode 1 wins when the cache can hold a non-null
 * sentinel for "no entry". The function picks mode 1 if `lookup` returns
 * an object with a `hit` boolean field.
 */
export async function instrumentCache<T>(
  opts: { layer: string },
  fn: (span: Span) => Promise<T | { hit: boolean; value: T }>
): Promise<T> {
  return withSpan(
    `cache.${opts.layer}`,
    async (span) => {
      setAttribute(span, "cache.layer", opts.layer);
      const result = await fn(span);
      // Mode 1: discriminated object.
      if (isHitResult(result)) {
        if (result.hit) {
          recordCacheHit(opts.layer);
          setAttribute(span, "cache.hit", true);
        } else {
          recordCacheMiss(opts.layer);
          setAttribute(span, "cache.hit", false);
        }
        return result.value;
      }
      // Mode 2: null/undefined → miss, anything else → hit.
      if (result === null || result === undefined) {
        recordCacheMiss(opts.layer);
        setAttribute(span, "cache.hit", false);
      } else {
        recordCacheHit(opts.layer);
        setAttribute(span, "cache.hit", true);
      }
      return result;
    },
    { kind: "INTERNAL" }
  );
}

/**
 * Wrap an upstream provider call. Emits the provider_attempts_total
 * counter (with outcome) and provider_call_duration_seconds histogram.
 *
 * The outcome is inferred from `fn`:
 *   - returns a Response with status < 400 → "success"
 *   - throws or returns status >= 400 → "error"
 *   - AbortError specifically → "timeout"
 *   - 429 → "rate_limited"
 *
 * If telemetry is disabled, `fn` still runs and the wrapper returns its
 * result. The metric calls are short-circuited.
 */
export async function instrumentProvider<T>(
  opts: { provider: string; model: string; tier?: string },
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    `provider.${opts.provider}`,
    async (span) => {
      setAttributes(span, {
        "provider.name": opts.provider,
        "provider.model": opts.model,
        ...(opts.tier ? { "provider.tier": opts.tier } : {}),
      });
      const t0 = Date.now();
      try {
        const result = await fn(span);
        const dur = (Date.now() - t0) / 1000;
        const outcome = isResponseLike(result) ? outcomeForStatus(result.status) : "success";
        if (isResponseLike(result)) setAttribute(span, "http.status_code", result.status);
        setAttribute(span, "provider.outcome", outcome);
        recordProviderAttempt({ provider: opts.provider, model: opts.model, outcome });
        recordProviderDuration({ provider: opts.provider, model: opts.model, durationSeconds: dur });
        return result;
      } catch (err) {
        const dur = (Date.now() - t0) / 1000;
        const outcome = err instanceof Error && err.name === "AbortError" ? "timeout" : "error";
        setAttribute(span, "provider.outcome", outcome);
        recordProviderAttempt({ provider: opts.provider, model: opts.model, outcome });
        recordProviderDuration({ provider: opts.provider, model: opts.model, durationSeconds: dur });
        throw err;
      }
    },
    { kind: "CLIENT", attributes: { "provider.name": opts.provider, "provider.model": opts.model } }
  );
}

/**
 * Same as {@link recordException} but tolerant of an undefined / null
 * span. Used in catch blocks that may run outside a withSpan context
 * (e.g. fire-and-forget background tasks).
 */
export function recordExceptionSafe(span: Span | null | undefined, err: unknown): void {
  if (!span) return;
  recordException(span, err);
  setSpanStatus(span, "ERROR", err instanceof Error ? err.message : String(err));
  // Don't end the span here — the caller may still want to add events.
  // We end only if the span was already ended; otherwise leave the
  // ownership with the caller.
  if (span.ended) {
    endSpan(span);
  }
}

/**
 * Lightweight helper that just emits the current traceId/spanId into a
 * logger. Used at module boundaries (auth, rate-limit, etc.) that don't
 * have a span in scope but want log correlation.
 */
export function logWithTrace(logger = getLogger(), msg: string, extra?: Record<string, unknown>): void {
  try {
    logger.info(msg, { traceId: currentTraceId(), spanId: currentSpanId(), ...(extra ?? {}) });
  } catch {
    logger.info(msg, extra);
  }
}

/* ──────────────── type guards ──────────────── */

function isResponseLike(v: unknown): v is { status: number; url?: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "status" in v &&
    typeof (v as { status: unknown }).status === "number"
  );
}

function isHitResult<T>(v: T | { hit: boolean; value: T }): v is { hit: boolean; value: T } {
  return (
    typeof v === "object" &&
    v !== null &&
    "hit" in v &&
    typeof (v as { hit: unknown }).hit === "boolean" &&
    "value" in v
  );
}

function outcomeForStatus(status: number): "success" | "error" | "rate_limited" {
  if (status === 429) return "rate_limited";
  if (status >= 400) return "error";
  return "success";
}

function readStatusFromSpan(span: Span): number {
  const attr = span.attributes["http.status_code"];
  if (typeof attr === "number") return attr;
  return 0;
}