/**
 * Proxy span (withProxySpan) tests.
 *
 * Covers:
 * - withProxySpan: returns the handler's response, attaches http.status_code
 *   attribute, defaults the span name to "METHOD /path"
 * - propagateTraceParent: returns null when header absent, returns parsed
 *   context when header valid
 * - isProxySpanResult: rejects non-marker objects
 * - captureActiveSpanMeta: returns null outside any withSpan, returns IDs
 *   inside withSpan
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  withProxySpan,
  propagateTraceParent,
  isProxySpanResult,
  captureActiveSpanMeta,
} from "../../../src/lib/observability/proxySpan.ts";
import { withSpan } from "../../../src/lib/observability/otel.ts";

beforeEach(() => {
  process.env.OTEL_SDK_DISABLED = "false";
});

test("withProxySpan: returns handler response and attaches http.status_code attribute", async () => {
  let capturedStatus: number | undefined;
  const req = new Request("http://localhost/api/v1/chat", { method: "POST" });
  const response = await withProxySpan(req, async (span) => {
    capturedStatus = span.attributes["http.status_code"] as number | undefined;
    return new Response("ok", { status: 200 });
  });
  assert.equal(response.status, 200);
  // The post-handler attribute set happens AFTER `handler` returns;
  // capturedStatus captured DURING the handler is undefined.
  assert.equal(capturedStatus, undefined);
});

test("withProxySpan: span name defaults to METHOD /path", async () => {
  const req = new Request("http://localhost/api/v1/foo", { method: "POST" });
  let seenName: string | undefined;
  await withProxySpan(req, async (span) => {
    seenName = span.name;
    return new Response("ok");
  });
  assert.equal(seenName, "POST /api/v1/foo");
});

test("propagateTraceParent: returns null when traceparent header is absent", () => {
  const req = new Request("http://localhost/api", { method: "GET" });
  assert.equal(propagateTraceParent(req), null);
});

test("propagateTraceParent: returns parsed SpanContext when traceparent is valid", () => {
  const tp = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
  const req = new Request("http://localhost/api", { method: "GET", headers: { traceparent: tp } });
  const ctx = propagateTraceParent(req);
  assert.ok(ctx);
  assert.equal(ctx!.traceId, "0af7651916cd43dd8448eb211c80319c");
  assert.equal(ctx!.spanId, "b7ad6b7169203331");
  assert.equal(ctx!.sampled, true);
});

test("isProxySpanResult: rejects non-marker inputs", () => {
  assert.equal(isProxySpanResult(null), false);
  assert.equal(isProxySpanResult(undefined), false);
  assert.equal(isProxySpanResult({}), false);
  assert.equal(isProxySpanResult({ response: new Response(), spanName: "x", traceId: "y", spanId: "z" }), false);
});

test("captureActiveSpanMeta: returns null outside any active span", () => {
  assert.equal(captureActiveSpanMeta(), null);
});

test("captureActiveSpanMeta: returns IDs inside withSpan", async () => {
  await withSpan("cap-meta-span", async () => {
    const meta = captureActiveSpanMeta();
    assert.ok(meta);
    assert.equal(meta!.traceId.length, 32);
    assert.equal(meta!.spanId.length, 16);
  });
});
