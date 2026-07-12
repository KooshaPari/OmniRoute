/**
 * OpenTelemetry facade for OmniRoute (B10 of v8.1, ADR-031).
 *
 * Single import surface for everything OTel-related across OmniRoute.
 * Imports from `@opentelemetry/api` ONLY — no SDK binding, exporter
 * selection, or OTLP wiring lives here. The SDK is bootstrapped from
 * `src/instrumentation-node.ts::registerNodejs()` (gated on
 * `OTEL_EXPORTER_OTLP_ENDPOINT`); until that runs, `trace.getTracer()`
 * returns the API's built-in no-op tracer and every span is non-recording.
 *
 * Why a facade at all?
 *
 *   1. Single import path — call sites read `import { getTracer } from
 *      "..."` and never have to know whether the SDK is registered.
 *   2. Single place to flip on/off without changing every call site.
 *   3. Single place to add cross-cutting helpers (recordException,
 *      isOtelEnabled, withSpan) without leaking OTel types into
 *      executor code.
 *
 * Behavior contract (enforced by the API package, not by us):
 *
 *   - getTracer() before init → returns the API no-op tracer.
 *     Every method on the returned Tracer/Span is a no-op.
 *   - getTracer() after init  → returns the SDK's tracer; spans
 *     are recorded and exported to the configured OTLP endpoint.
 *
 * Operators opt in by setting:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318
 *
 * When unset, the call-site code is a no-op with no measurable overhead
 * beyond a few function calls — the API's no-op tracer is hand-tuned to
 * short-circuit.
 *
 * Reference: docs/adr/0031-bifrost-tier1-router.md (ADR-031), PLAN.md
 * § 2.5.2 (B10), `src/instrumentation-node.ts` (the SDK bootstrap).
 *
 * @module open-sse/observability/otelExporter
 */

import {
  trace,
  type Tracer,
  type Span,
  type Exception,
  SpanStatusCode,
} from "@opentelemetry/api";

/**
 * Env-var name that opts the process into OTLP export. Read at call
 * time (not at module-load) so that the bootstrap in
 * `instrumentation-node.ts` can mutate the process env before any
 * downstream `isOtelEnabled()` check.
 */
const OTLP_ENDPOINT_ENV = "OTEL_EXPORTER_OTLP_ENDPOINT";

/**
 * Has the operator opted in to OTel export? True iff the OTLP endpoint
 * env var is set to a non-empty string AND `OTEL_SDK_DISABLED` is not
 * set to a truthy value. Used by:
 *
 *   - bifrostSpan.ts / comboSpan.ts to decide whether to bother
 *     emitting span attributes (the no-op tracer is already free, but
 *     a `JSON.stringify` of a large body would still cost).
 *   - instrumentation-node.ts to decide whether to boot the SDK.
 *   - the docs / dashboards to surface an "OTel: on/off" indicator.
 *
 * `OTEL_SDK_DISABLED` is the OTel-spec standard switch (RFC §"SDK
 * configuration") — when set to `"true"`, the SDK stays off even if
 * an endpoint is configured.
 */
export function isOtelEnabled(): boolean {
  const value = process.env[OTLP_ENDPOINT_ENV];
  if (typeof value !== "string" || value.length === 0) return false;
  const disabled = process.env["OTEL_SDK_DISABLED"]?.trim().toLowerCase();
  if (disabled === "true" || disabled === "1" || disabled === "yes" || disabled === "on") {
    return false;
  }
  return true;
}

/**
 * Cached "did we already log init?" flag. The init log fires exactly
 * once per process from `instrumentation-node.ts`; this constant lets
 * `isOtelEnabled()` report the same fact without re-evaluating anything.
 */
let initLogged = false;

/**
 * Mark the OTel bootstrap as logged so the operator console doesn't
 * see a flood of identical lines. Called by `instrumentation-node.ts`
 * immediately after it initializes the SDK.
 */
export function markOtelInitLogged(): void {
  initLogged = true;
}

/**
 * Read whether the init log has been emitted. Exported for tests.
 * @internal
 */
export function _wasOtelInitLogged(): boolean {
  return initLogged;
}

/**
 * Reset the init-logged flag. Test-only.
 * @internal
 */
export function _resetOtelInitLoggedForTest(): void {
  initLogged = false;
}

/**
 * Resolve a Tracer by name. Pass-through to `trace.getTracer(name)` so
 * the call site is identical whether the SDK is up or not.
 *
 * The `name` is the OTel instrumentation-scope name — used by the
 * backend to attribute spans to a library. Conventions:
 *
 *   - `"omniroute.bifrost"`     — bifrostSpan.ts (Tier-1 router bridge)
 *   - `"omniroute.combo"`       — comboSpan.ts (combo orchestrator)
 *   - `"omniroute.chatCore"`    — handlers/chatCore.ts (Tier-2 entry)
 *
 * Version is hardcoded to the package version at module load. If we
 * later wire a build-time inject, swap this for that constant.
 */
const OMNIROUTE_VERSION = "3.8.25";

export function getTracer(name: string): Tracer {
  return trace.getTracer(name, OMNIROUTE_VERSION);
}

/**
 * Standard `Span.recordException` convenience. The OTel API defines
 * `recordException` on every Span (real or no-op), so this wrapper
 * exists only to:
 *
 *   1. Narrow the `error` argument to something serializable
 *      (`Exception` is `unknown` per the spec).
 *   2. Normalize the call so future enhancements (e.g. capturing
 *      local stack frames before recording) land in one place.
 *
 * Always also sets the span status to ERROR so the trace UI can
 * surface the failure. The OTel spec says `recordException` does
 * NOT change span status — it only attaches an event — so the
 * status flip is the caller's responsibility.
 */
export function recordException(span: Span, error: unknown): void {
  if (!span) return;
  try {
    span.recordException(error as Exception);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
  } catch {
    // Never let a span helper take down the request path. The
    // exception event is best-effort; if the span is already ended
    // or the API threw, swallow.
  }
}

/**
 * End a span safely — same swallow-on-failure contract as
 * `recordException`. The OTel `Span.end()` is idempotent in the
 * reference SDKs but we still wrap to be defensive against future
 * SDKs that might throw on double-end.
 */
export function endSpanSafely(span: Span): void {
  if (!span) return;
  try {
    span.end();
  } catch {
    // Swallow — see recordException.
  }
}

/**
 * Set a span status to OK. Convenience for the success path that
 * doesn't need to encode a message.
 */
export function markSpanOk(span: Span): void {
  if (!span) return;
  try {
    span.setStatus({ code: SpanStatusCode.OK });
  } catch {
    // Swallow.
  }
}

/**
 * Read the OTLP endpoint env var without exposing the raw name.
 * Used by `instrumentation-node.ts` to wire the exporter. Returns
 * `null` when unset (instead of `undefined`) so callers can use a
 * single `?? null` pattern.
 */
export function getOtlpEndpoint(): string | null {
  const value = process.env[OTLP_ENDPOINT_ENV];
  return typeof value === "string" && value.length > 0 ? value : null;
}
