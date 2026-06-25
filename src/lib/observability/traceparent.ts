/**
 * W3C Trace Context — `traceparent` header parser and builder.
 *
 * Spec: https://www.w3.org/TR/trace-context/#traceparent-header
 *
 * Wire format (single line, no whitespace):
 *   <version>-<trace-id>-<parent-id>-<trace-flags>
 *
 * Where:
 *   - version: 2 hex chars (must be "00" — the only version spec'd; future
 *     versions reserve this header for backwards-compat).
 *   - trace-id: 32 hex chars (16 bytes). Must NOT be all zeros.
 *   - parent-id (a.k.a. span-id): 16 hex chars (8 bytes). Must NOT be
 *     all zeros.
 *   - trace-flags: 2 hex chars (1 byte). Bit 0 (mask 0x01) is the sampled
 *     flag; all other bits are reserved.
 *
 * Invalid headers return `null` from `parseTraceParent` / `extractTraceParent`.
 * We do NOT throw — propagation must never crash the request pipeline.
 *
 * `injectTraceParent(span, headers)` and `extractTraceParent(req)` are
 * the request-boundary helpers used by the bifrost relay route and any
 * future fetch instrumentation.
 */

import type { Span, SpanContext } from "./spanTypes.ts";

const HEX_RE_2 = /^[0-9a-f]{2}$/;
const HEX_RE_32 = /^[0-9a-f]{32}$/;
const HEX_RE_16 = /^[0-9a-f]{16}$/;
const ZERO_TRACE_ID = "00000000000000000000000000000000";
const ZERO_SPAN_ID = "0000000000000000";

/**
 * Parsed W3C traceparent. `flags` is the raw byte (0-255); `sampled`
 * is the convenience boolean derived from bit 0. Field names align
 * with the test fixtures and the W3C `tracestate` doc.
 */
export interface TraceParent {
  readonly version: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly flags: string;
  readonly traceFlags: number;
  readonly sampled: boolean;
}

/**
 * Parse a single `traceparent` header value into a structured TraceParent
 * or null if invalid (per spec: invalid → treat as if header is absent).
 *
 * Validation rules:
 *   - exactly 4 fields separated by "-"
 *   - version = "00" (forward-compat: any other version is treated as
 *     "future version we don't understand" and ignored — per spec, this
 *     preserves correctness with newer OTel versions that might emit
 *     different formats)
 *   - trace-id 32 hex chars, not all zeros
 *   - parent-id 16 hex chars, not all zeros
 *   - trace-flags 2 hex chars (parsed as 1 byte)
 *
 * We accept lowercase hex only (the spec mandates lowercase).
 */
export function parseTraceParent(header: string | null | undefined): TraceParent | null {
  if (!header) return null;
  if (typeof header !== "string") return null;
  // Spec says exactly one traceparent header — we accept the FIRST
  // occurrence if a comma-separated list slips through, but in practice
  // every HTTP server collapses duplicate headers.
  const value = header.split(",")[0]?.trim();
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 4) return null;
  const [version, traceId, spanId, flagsRaw] = parts;
  if (!version || !traceId || !spanId || !flagsRaw) return null;
  if (!HEX_RE_2.test(version)) return null;
  // Spec: if version != "00" we MUST still attempt to parse the lower
  // 96 bits because the header shape for v00 was preserved. Future
  // versions MAY extend the format; we choose to ignore them entirely
  // (treat as invalid) — the spec allows this. Loophole for forward-
  // compat is not worth the complexity here.
  if (version !== "00") return null;
  if (!HEX_RE_32.test(traceId)) return null;
  if (traceId === ZERO_TRACE_ID) return null;
  if (!HEX_RE_16.test(spanId)) return null;
  if (spanId === ZERO_SPAN_ID) return null;
  if (!HEX_RE_2.test(flagsRaw)) return null;
  const traceFlags = Number.parseInt(flagsRaw, 16);
  if (!Number.isFinite(traceFlags)) return null;
  const sampled = (traceFlags & 0x01) === 0x01;
  return {
    version,
    traceId,
    spanId,
    flags: flagsRaw,
    traceFlags,
    sampled,
  };
}

/**
 * Build a `traceparent` header string from individual fields. Inputs are
 * NOT validated here (use parseTraceParent on the reverse direction);
 * callers are expected to pass valid hex / numeric values.
 *
 * `flags` may be passed as a number (0x00-0xff, default 0x01 = sampled)
 * or as a 2-char lowercase hex string.
 */
export function buildTraceParent(
  traceId: string,
  spanId: string,
  flags: number | string = 0x01
): string {
  const f =
    typeof flags === "string"
      ? flags
      : (flags & 0xff).toString(16).padStart(2, "0");
  return `00-${traceId}-${spanId}-${f}`;
}

/**
 * Inject a `traceparent` header into an existing headers bag. Returns the
 * input headers object — does NOT mutate the input.
 *
 * Accepts a Span, SpanContext, or a parsed TraceParent (so callers can
 * re-emit an inbound traceparent without re-parsing it).
 *
 * If `headers` is a Headers instance (fetch-style), the helper delegates
 * to its `.set()` method. If it's a plain Record, it adds the key in
 * place. Existing `traceparent` entries are overwritten.
 */
export function injectTraceParent(
  source: Span | SpanContext | TraceParent,
  headers: Headers | Record<string, string>
): Headers | Record<string, string> {
  const ctx = isSpan(source) ? source.context : source;
  const value = buildTraceParent(ctx.traceId, ctx.spanId, ctx.traceFlags);
  if (headers instanceof Headers) {
    headers.set("traceparent", value);
    return headers;
  }
  (headers as Record<string, string>)["traceparent"] = value;
  return headers;
}

/**
 * Extract a TraceParent from an inbound Request (or its parsed headers).
 * Returns null when the header is missing or malformed.
 *
 * Accepts:
 *   - a fetch Request (we read `.headers.get("traceparent")`)
 *   - a plain object with a `headers` field that itself is a Headers
 *     instance, a `{ get(name) }` duck-type, or a Record
 *   - a Headers instance directly
 */
export function extractTraceParent(
  req:
    | Request
    | Headers
    | { headers: Headers | Record<string, string> | { get(name: string): string | null } }
): TraceParent | null {
  let headers: Headers | Record<string, string> | { get(name: string): string | null } | null = null;
  if (req instanceof Headers) {
    headers = req;
  } else if ("headers" in req && req.headers) {
    headers = req.headers;
  }
  if (!headers) return null;
  let value: string | null = null;
  if (headers instanceof Headers) {
    value = headers.get("traceparent");
  } else if (typeof (headers as { get?: unknown }).get === "function") {
    value = (headers as { get(name: string): string | null }).get("traceparent");
  } else if (typeof headers === "object") {
    const h = (headers as Record<string, string>)["traceparent"];
    if (typeof h === "string") value = h;
  }
  return parseTraceParent(value);
}

/* ──────────────── helpers ──────────────── */

/**
 * Type guard distinguishing a full Span (has `.context`) from a raw
 * SpanContext / TraceParent (which carry the same shape but no `.context`).
 */
function isSpan(x: Span | SpanContext | TraceParent): x is Span {
  return (
    typeof (x as Span).context === "object" &&
    (x as Span).context !== null &&
    !("flags" in x)
  );
}