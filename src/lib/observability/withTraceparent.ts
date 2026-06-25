/**
 * `withTraceparent` — fetch / route handler wrapper that injects a
 * `traceparent` header derived from the active span onto outgoing
 * requests.
 *
 * This is the **deliverable of PR-006**: trace continuity end-to-end
 * across the bifrost relay boundary.
 *
 *   POST /api/v1/relay/chat/completions/bifrost  ─┐
 *     withTraceparent wrapper                    │
 *       outbound fetch(BIFROST_BASE_URL/...)     │
 *         ↳ traceparent: 00-<trace-id>-<span-id>-01
 *   ↳ ...                                         │
 *   bifrost sidecar                                │
 *     ↳ extracts traceparent, joins the trace    ─┘
 *
 * Two wrapping modes:
 *
 *   1. `withTraceparent(handler)` where `handler({ url, init }) =>
 *      Promise<Response>` — generic wrapper, used by tests and by
 *      call sites that build the request from scratch.
 *
 *   2. `withTraceparent(handler, { headerName })` — override the header
 *      name. Default: "traceparent". The override exists for legacy
 *      sidecars that read "x-traceparent" or similar.
 *
 * Telemetry-off behavior: when `OTEL_SDK_DISABLED=true`, there is no
 * active span. The wrapper falls back to NOT injecting a traceparent
 * (the request goes out unmodified). Operators can opt back in by
 * either flipping the env var or by passing `opts.forceInject = true`.
 */

import { currentSpan } from "./otel.ts";
import { buildTraceParent, injectTraceParent } from "./traceparent.ts";
import type { Span } from "./spanTypes.ts";

/**
 * Options accepted by {@link withTraceparent}.
 */
export interface WithTraceparentOptions {
  /**
   * Custom header name. Defaults to "traceparent". Used by callers that
   * integrate with legacy systems that read "x-traceparent" or a vendor-
   * specific header (e.g. AWS X-Amzn-Trace-Id).
   */
  readonly headerName?: string;
  /**
   * Force injection even when telemetry is disabled. Off by default so
   * the wrapper doesn't accidentally start shipping trace IDs to
   * downstream services that haven't opted into the W3C standard.
   */
  readonly forceInject?: boolean;
}

/**
 * Shape of the request builder accepted by {@link withTraceparent}. We
 * intentionally keep it minimal so the wrapper can be plugged into both
 * raw `fetch()` calls and higher-level HTTP clients (axios, undici,
 * got) with a one-line adapter.
 */
export interface FetchRequestBuilder {
  /**
   * Build the outgoing request. The wrapper MAY mutate the returned
   * `init.headers` (or, if `init.headers` is a Headers instance, call
   * `.set()` on it) to add the `traceparent` header.
   */
  build(): { url: string; init: RequestInit };
  /**
   * Actually perform the HTTP request and return a Response. Separated
   * from `build()` so the wrapper can mutate headers before the network
   * call goes out.
   */
  fetch(url: string, init: RequestInit): Promise<Response>;
}

/**
 * Wrap a fetch-style handler so the outgoing request gets a `traceparent`
 * header derived from the currently active span.
 *
 * The handler is responsible for assembling the request (via
 * `request.build()`) and dispatching it (`request.fetch(url, init)`).
 * The wrapper calls `build()`, injects the header, then calls
 * `fetch(url, init)` and returns the response.
 */
export async function withTraceparent(
  request: FetchRequestBuilder,
  opts: WithTraceparentOptions = {}
): Promise<Response> {
  const headerName = (opts.headerName ?? "traceparent").toLowerCase();
  const built = request.build();
  const initWithHeaders = ensureHeadersShape(built.init);
  const span = currentSpan();
  if (span) {
    const value = buildTraceParent(span.context.traceId, span.context.spanId, span.context.traceFlags);
    if (initWithHeaders instanceof Headers) {
      initWithHeaders.set(headerName, value);
    } else {
      initWithHeaders[headerName] = value;
    }
  } else if (opts.forceInject === true) {
    // Caller asked to ALWAYS inject — emit a fresh root trace.
    const fresh = freshRootTraceparent();
    if (initWithHeaders instanceof Headers) {
      initWithHeaders.set(headerName, fresh);
    } else {
      initWithHeaders[headerName] = fresh;
    }
  }
  return request.fetch(built.url, { ...built.init, headers: initWithHeaders });
}

/**
 * Convenience: a default `FetchRequestBuilder` that simply forwards to
 * the global `fetch`. Use this when the call site doesn't have its own
 * adapter:
 *
 *   await withTraceparent(defaultFetchBuilder("http://upstream", { method: "POST", body }));
 */
export function defaultFetchBuilder(
  url: string,
  init: RequestInit
): FetchRequestBuilder {
  return {
    build: () => ({ url, init }),
    fetch: async (u, i) => {
      const f = (globalThis as { fetch?: typeof fetch }).fetch ?? fetch;
      return f(u, i);
    },
  };
}

/**
 * Helper for tests / advanced use: inject a traceparent onto a fetch
 * RequestInit's headers in-place. Used by the bifrost route to bridge
 * between `withTraceparent` and its existing fetch call.
 */
export function injectIntoRequestInit(
  init: RequestInit,
  span: Span | null,
  headerName: string = "traceparent"
): RequestInit {
  const headers = ensureHeadersShape(init);
  if (span) {
    const value = buildTraceParent(span.context.traceId, span.context.spanId, span.context.traceFlags);
    if (headers instanceof Headers) headers.set(headerName, value);
    else headers[headerName] = value;
  }
  return { ...init, headers };
}

/* ──────────────── internals ──────────────── */

/**
 * Normalize the `init.headers` field to either a Headers instance or a
 * plain Record. We do this so the same mutation logic works whether the
 * caller passes a Headers, a Record, or undefined.
 */
function ensureHeadersShape(init: RequestInit): Headers | Record<string, string> {
  if (init.headers === undefined) {
    return {};
  }
  if (init.headers instanceof Headers) {
    return init.headers;
  }
  if (Array.isArray(init.headers)) {
    // RequestInit allows HeadersInit = Headers | Record | string[][]
    const out: Record<string, string> = {};
    for (const entry of init.headers) {
      if (Array.isArray(entry) && entry.length === 2) {
        const [k, v] = entry;
        if (typeof k === "string" && typeof v === "string") {
          out[k] = v;
        }
      }
    }
    return out;
  }
  // Already a Record<string, string> — return a shallow copy so we don't
  // mutate the caller's reference.
  return { ...(init.headers as Record<string, string>) };
}

/**
 * Generate a fresh root traceparent (for `forceInject: true`). Uses the
 * same crypto helpers as the otel module so the IDs match the format
 * generated for new spans.
 */
function freshRootTraceparent(): string {
  // Defer-import the otel helpers to avoid a circular import (otel.ts
  // imports resource.ts; we want to stay independent).
  // Direct call here: re-implement the small bit we need.
  return buildTraceParent(randomHex(32), randomHex(16), 0x01);
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    s += h.length === 1 ? "0" + h : h;
  }
  return s.slice(0, length);
}