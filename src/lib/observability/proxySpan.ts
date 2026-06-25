/**
 * Next.js proxy/relay span wiring.
 *
 * `withProxySpan(req, handler)` wraps a Next.js route handler so that:
 *   1. The incoming `traceparent` header (if any) becomes the parent of
 *      the new server span — trace continuity across services.
 *   2. The handler runs inside an AsyncLocalStorage frame so child
 *      instrumentation (instrumentFetch, instrumentDb, …) sees the active
 *      span via `currentSpan()`.
 *   3. Errors are recorded on the span; the span ends with ERROR status.
 *
 * `propagateTraceParent(req)` is the inverse direction — read the
 * `traceparent` header off an incoming Request and turn it into a
 * SpanContext that callers can attach as the parent of an outbound
 * span.
 *
 * `isProxySpanResult(x)` is a tiny discriminator used by the bifrost
 * route handler to recognize the marker return shape (so unit tests can
 * stub the wrapper and assert what span context was active).
 */

import { withSpan, setAttribute, setAttributes, recordException, currentSpan, getTracer } from "./otel.ts";
import type { Span } from "./spanTypes.ts";
import { extractTraceParent } from "./traceparent.ts";

/**
 * Marker interface returned by `withProxySpan` so consumers (and tests)
 * can detect "this Response was produced by a wrapped handler". We don't
 * actually need to attach anything to the Response itself — the marker
 * is a no-op property set on a wrapper object the user can check.
 */
export interface ProxySpanResult {
  readonly response: Response;
  readonly spanName: string;
  readonly traceId: string;
  readonly spanId: string;
}

const PROXY_SPAN_MARKER = Symbol.for("@omniroute/observability/proxySpan");

/**
 * Type guard for the ProxySpanResult. Used in tests.
 */
export function isProxySpanResult(x: unknown): x is ProxySpanResult {
  return (
    typeof x === "object" &&
    x !== null &&
    PROXY_SPAN_MARKER in (x as Record<symbol, unknown>)
  );
}

/**
 * Wrap a Next.js route handler in a SERVER span. Reads the inbound
 * `traceparent` header (if any) and uses it as the parent so the server
 * span joins the upstream trace.
 *
 * @param req       — the incoming Request (fetch-style)
 * @param handler   — async function that produces the Response
 * @param opts.name — explicit span name; defaults to the request method + URL
 */
export async function withProxySpan(
  req: Request,
  handler: (span: Span) => Promise<Response>,
  opts: { name?: string } = {}
): Promise<Response> {
  const parent = propagateTraceParent(req);
  const spanName = opts.name ?? defaultSpanName(req);
  const tracer = getTracer("@omniroute/observability.proxy");
  const span = tracer.startSpan(spanName, {
    kind: "SERVER",
    parent,
    attributes: {
      "http.method": req.method,
      "http.url": req.url,
      "http.target": extractPath(req.url),
    },
  });
  try {
    const response = await runHandlerWithSpan(span, handler);
    setAttribute(span, "http.status_code", response.status);
    if (response.status >= 500) {
      setAttribute(span, "error", true);
    }
    return response;
  } catch (err) {
    recordException(span, err);
    setAttribute(span, "http.status_code", 500);
    setAttribute(span, "error", true);
    throw err;
  } finally {
    if (!span.ended) {
      span.endTime = Date.now();
      span.durationSeconds = Math.max(0, (span.endTime - span.startTime) / 1000);
      span.ended = true;
    }
  }
}

/**
 * Convenience: read the traceparent off `req` and return the parsed
 * context (or null if absent / invalid). The caller uses this to set the
 * parent on an outbound span or to seed a new root if invalid.
 */
export function propagateTraceParent(req: Request): import("./spanTypes.ts").SpanContext | null {
  const header = req.headers.get("traceparent");
  if (!header) return null;
  return extractTraceParent(req);
}

/**
 * Capture the active span (if any) and its trace/span IDs as a small
 * record. Used by route handlers that want to attach trace IDs to
 * outgoing responses (X-Trace-Id, X-Span-Id headers) without going
 * through the full Span API.
 */
export function captureActiveSpanMeta(): { traceId: string; spanId: string } | null {
  const span = currentSpan();
  if (!span) return null;
  return { traceId: span.context.traceId, spanId: span.context.spanId };
}

/**
 * Internal: run the handler inside an AsyncLocalStorage frame so nested
 * withSpan calls see the proxy span as their parent. We push the frame
 * here (rather than via the tracer's withSpan) so we can also attach
 * attributes AFTER the handler returns (e.g. http.status_code).
 */
async function runHandlerWithSpan(
  span: Span,
  handler: (s: Span) => Promise<Response>
): Promise<Response> {
  // Re-use withSpan's storage frame logic by calling it with a dummy
  // endTime and capturing the response manually.
  return withSpan(
    span.name,
    async (s) => {
      // Copy any attributes already on `span` into the active span so
      // instrumentFetch/etc see them.
      setAttributes(s, span.attributes);
      return handler(s);
    },
    { kind: "SERVER", parent: span.parentSpanContext, attributes: span.attributes }
  );
}

function defaultSpanName(req: Request): string {
  const method = req.method || "GET";
  const path = extractPath(req.url);
  return `${method} ${path}`;
}

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}