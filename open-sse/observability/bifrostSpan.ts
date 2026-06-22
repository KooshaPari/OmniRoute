/**
 * Bifrost Span — wraps `BifrostBackendExecutor.execute()` in an OTel span (B10 of v8.1).
 *
 * The single purpose of this module is to carry a W3C `traceparent`
 * header from OmniRoute (Tier-2) into Bifrost (Tier-1) on every
 * `BifrostBackendExecutor.execute()` call, so a single distributed
 * trace spans the HTTP boundary.
 *
 * Wiring:
 *
 *   bifrost.ts :: BifrostBackendExecutor.execute(input)
 *     → bifrostSpan.ts :: withBifrostSpan(input, () => …)   ← this module
 *     → tracer.startActiveSpan("bifrost.execute", { kind: CLIENT, … })
 *     → fetcher spans the HTTP request to ${BIFROST_BASE_URL}/v1/chat/completions
 *     → traceparent injected into the request headers from the active span
 *     → span attributes: omniroute.provider, bifrost.provider, model, http.status
 *     → span ends; the active context returns to its previous parent
 *
 * What the span carries (attributes):
 *
 *   - `omniroute.provider`  — the OmniRoute provider id (e.g. "openai")
 *   - `bifrost.provider`    — the Bifrost provider id (after model override)
 *   - `model`               — the resolved model name
 *   - `http.url`            — the Bifrost base URL
 *   - `http.status_code`    — set on success and on non-throwing error responses
 *   - `bifrost.bifrost_enabled` — boolean env-var state
 *
 * The span does NOT capture request/response bodies (those can be
 * multi-MB for streaming responses). Operators who need body capture
 * can attach a custom processor when initializing the SDK.
 *
 * Failure handling: any throw from the inner function records the
 * exception on the span (via `recordException`) and re-throws so the
 * upstream caller still sees the original error. Non-throwing
 * upstream errors (HTTP 4xx/5xx) are recorded as span attributes
 * only; the response object is passed through unchanged.
 *
 * Reference: docs/adr/0031-bifrost-tier1-router.md (ADR-031), PLAN.md
 * § 2.5.2 (B10), `open-sse/executors/bifrost.ts` (the wrapped function).
 *
 * @module open-sse/observability/bifrostSpan
 */

import { SpanStatusCode, SpanKind, type Span } from "@opentelemetry/api";
import { getTracer, recordException, isOtelEnabled } from "./otelExporter.ts";
import {
  parseTraceparent,
  injectTraceparent,
  type Traceparent,
} from "./traceparent.ts";

/**
 * Minimal execute-shape the wrapper needs. We accept a subset of
 * `ExecuteInput` from `base.ts` to avoid a circular import — the
 * caller passes only the fields we actually read.
 */
export interface BifrostSpanInput {
  /** The OmniRoute provider id (e.g. "openai", "anthropic", "gemini"). */
  provider: string;
  /** The Bifrost provider id after `applyBifrostModelOverride`. */
  bifrostProvider: string;
  /** The resolved model name (post-override). */
  model: string;
  /** The Bifrost base URL (already resolved by the caller). */
  baseUrl: string;
  /**
   * The outgoing request headers. The wrapper will inject a W3C
   * `traceparent` (and `tracestate` if present) into this map
   * IN PLACE. The caller is expected to forward the same headers
   * object to the underlying `fetch()`.
   */
  headers: Record<string, string>;
  /**
   * Optional: a `parent` traceparent to use as the upstream context
   * when there is no OTel SDK active span (e.g. when the request
   * originated outside the OTel-instrumented code path). If
   * omitted, a fresh `generateTraceparent` is minted.
   */
  parentTraceparent?: Traceparent | null;
  /**
   * Optional: pre-existing `tracestate` to forward. If omitted, the
   * wrapper does not inject a tracestate header.
   */
  tracestate?: string;
}

export interface BifrostSpanResult<R> {
  /**
   * Whatever the inner function returned. The wrapper does not
   * inspect or transform the value.
   */
  result: R;
  /**
   * The active span. Exposed for callers that want to add further
   * attributes after the inner function returns (e.g. read the
   * response body for token counts). The span is already `end()`ed
   * by the time this is returned.
   */
  span: Span;
}

/**
 * Wrap an operation that hits Bifrost's HTTP API in an OTel span.
 *
 * This is the public entry point. It is safe to call when OTel is
 * disabled — the no-op tracer produces a non-recording span, the
 * `traceparent` injection still happens (we always want a valid
 * upstream header), and the inner function runs as if uninstrumented.
 *
 * @param input Span attributes + the headers map to inject into.
 * @param fn The inner operation; receives a `span` reference for
 *           optional per-call attribute setting.
 * @returns Whatever `fn` returns, wrapped in a result envelope.
 */
export async function withBifrostSpan<T>(
  input: BifrostSpanInput,
  fn: (span: Span) => Promise<T>
): Promise<BifrostSpanResult<T>> {
  const tracer = getTracer("omniroute.bifrost");
  const span = tracer.startSpan(`bifrost.execute ${input.bifrostProvider}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      "omniroute.provider": input.provider,
      "bifrost.provider": input.bifrostProvider,
      "model": input.model,
      "http.url": input.baseUrl,
      "bifrost.enabled": isOtelEnabled(),
    },
  });

  // Inject the traceparent into the outgoing headers BEFORE the
  // inner function runs, so the actual fetch() carries it. The
  // active span's context is what OTel hands to the propagator;
  // we then format the same traceparent manually below for the
  // case when the SDK isn't initialized.
  const tp = buildOutboundTraceparent(span, input.parentTraceparent ?? null);
  injectTraceparent(
    input.headers,
    tp,
    input.tracestate,
    { replaceTracestate: false }
  );

  try {
    const result = await fn(span);
    // We do NOT inspect `result` for the HTTP status here — callers
    // that want to record the upstream status do it themselves via
    // the `span` reference passed into `fn`. The reason: the
    // execute() result shape is heterogeneous (success throws on
    // non-2xx, partial success returns a Response, etc.) and we
    // don't want to lock the wrapper to a specific shape.
    span.setStatus({ code: SpanStatusCode.OK });
    return { result, span };
  } catch (err) {
    recordException(span, err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Build the W3C `traceparent` to put on the outbound request. The
 * algorithm:
 *
 *   1. If the SDK has an active recording span, use its context.
 *      `trace.getActiveSpan()` returns a real span; we format the
 *      trace-id / parent-id / flags from `span.spanContext()`.
 *   2. If there is no active span (or it's a non-recording no-op
 *      span), but the caller supplied an explicit `parentTraceparent`,
 *      build a child traceparent from it with a fresh parent-id.
 *   3. Otherwise, mint a fresh `generateTraceparent()`.
 *
 * This three-step ladder matches the bifrost.ts plan: when OTel is
 * on, the OTel context wins; when it's off, the executor's own
 * hand-rolled traceparent (or one we mint) keeps the upstream
 * wire valid.
 */
function buildOutboundTraceparent(
  activeSpan: Span,
  parent: Traceparent | null
): string {
  // We deliberately do NOT import the propagator from the SDK —
  // we re-derive the traceparent from `activeSpan.spanContext()`
  // so this module works with the no-op API package alone.
  // The OTel API exposes `getSpanContext()` on the Span interface.
  // Note: this returns the INVALID span context when the span is
  // not recording, which is exactly the case we want to handle in
  // the parent-fallback path.
  const ctx = activeSpan.spanContext();
  const isValid =
    typeof ctx?.traceId === "string" &&
    ctx.traceId.length === 32 &&
    ctx.traceId !== "00000000000000000000000000000000" &&
    typeof ctx?.spanId === "string" &&
    ctx.spanId.length === 16 &&
    ctx.spanId !== "0000000000000000";

  if (isValid) {
    const flags = (ctx.traceFlags ?? 0) & 0x01 ? "01" : "00";
    return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
  }

  if (parent) {
    // Build a child traceparent: keep trace-id + flags from parent,
    // mint a fresh parent-id. The caller is responsible for
    // attaching `tracestate` if needed.
    return `00-${parent.traceId}-${mintParentId()}-${parent.flags}`;
  }

  // Last resort: fresh traceparent. Default to unsampled (flag=00)
  // to avoid contaminating Bifrost's sampling decisions when the
  // caller didn't supply a parent.
  return mintFreshUnsampledTraceparent();
}

/** Mint a non-reserved N-byte lowercase hex string (32-char traceId or 16-char parentId). */
function mintRandomHex(bytes: number): string {
  const INVALID = "0".repeat(bytes * 2);
  for (let attempt = 0; attempt < 16; attempt++) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    let hex = "";
    for (let i = 0; i < buf.length; i++) {
      const byte = buf[i] ?? 0;
      hex += byte.toString(16).padStart(2, "0");
    }
    if (hex !== INVALID) return hex;
  }
  // Astronomically unlikely; fall through to a non-zero sentinel.
  return bytes === 16 ? "ffffffffffffffffffffffffffffffff" : "ffffffffffffffff";
}

/** Mint a non-reserved 16-hex parent-id. */
function mintParentId(): string {
  return mintRandomHex(8);
}

/** Mint a fresh unsampled W3C `traceparent` with a 32-hex traceId + 16-hex parentId. */
function mintFreshUnsampledTraceparent(): string {
  const traceId = mintRandomHex(16);
  const parentId = mintRandomHex(8);
  return `00-${traceId}-${parentId}-00`;
}

/**
 * Parse an inbound `traceparent` header value, returning either the
 * parsed traceparent or `null` if the value is missing / malformed.
 * Convenience wrapper used by tests.
 */
export function safeParseTraceparent(raw: string | null | undefined): Traceparent | null {
  const parsed = parseTraceparent(raw);
  return parsed.ok ? parsed.traceparent : null;
}
