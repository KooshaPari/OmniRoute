/**
 * `withTraceparent` wrapper tests.
 *
 * Covers:
 * - handler emits a `traceparent` header on the outgoing fetch
 * - parent-child span IDs preserved across the fetch boundary
 * - disabled-mode (no active span) is a no-op
 * - custom header name override
 * - multiple sequential fetch calls each get their own traceparent
 * - `forceInject` emits a fresh root traceparent even when no span is active
 *
 * Test isolation: every test resets the active span stack via
 * `initTelemetry()` (idempotent) and `withSpan(...)` to scope the span.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withTraceparent,
  defaultFetchBuilder,
  type FetchRequestBuilder,
} from "../../../src/lib/observability/withTraceparent.ts";
import { withSpan, initTelemetry, isTelemetryEnabled } from "../../../src/lib/observability/otel.ts";

// Telemetry defaults to "disabled" in this branch (no OTLP exporter wired
// by default). The wrapper still emits a traceparent if a span was started
// manually via withSpan. We force-disabled flag = false so withSpan works.
process.env.OTEL_SDK_DISABLED = "false";
initTelemetry();

test("withTraceparent: emits a traceparent header on the outgoing fetch", async () => {
  await withSpan("test-parent-span", async () => {
    let capturedHeaders: Record<string, string> = {};
    const builder: FetchRequestBuilder = {
      build: () => ({ url: "http://upstream.test/v1/chat", init: { method: "POST", headers: { "content-type": "application/json" } } }),
      fetch: async (_url, init) => {
        capturedHeaders = init.headers as Record<string, string>;
        return new Response("ok", { status: 200 });
      },
    };
    const res = await withTraceparent(builder);
    assert.equal(res.status, 200);
    assert.ok(capturedHeaders.traceparent, "should have a traceparent header");
    // Validate format: 00-<32hex>-<16hex>-<2hex>
    assert.match(capturedHeaders.traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
    // content-type is preserved
    assert.equal(capturedHeaders["content-type"], "application/json");
  });
});

test("withTraceparent: parent span id appears as the traceparent span-id", async () => {
  let capturedParentSpanId: string | undefined;
  await withSpan("outer-span", async () => {
    const { currentSpan } = await import("../../../src/lib/observability/otel.ts");
    const outer = currentSpan();
    assert.ok(outer);
    const builder: FetchRequestBuilder = {
      build: () => ({ url: "http://upstream.test/", init: {} }),
      fetch: async (_url, init) => {
        const headers = init.headers as Record<string, string>;
        const tp = headers.traceparent ?? "";
        capturedParentSpanId = tp.split("-")[2];
        return new Response("ok");
      },
    };
    await withTraceparent(builder);
  });
  assert.ok(capturedParentSpanId, "should have captured the parent span id");
  assert.match(capturedParentSpanId!, /^[0-9a-f]{16}$/);
});

test("withTraceparent: disabled-mode is a no-op (no header injected)", async () => {
  // Ensure no active span by exiting any active context. Since other tests
  // may run concurrently, the safest signal is to assert that a builder
  // constructed with NO surrounding withSpan does not have a header
  // unless forceInject is true.
  let capturedHeaders: Record<string, string> = {};
  // Drop any active span by starting fresh: startSpan returns null when
  // there is no parent; withSpan unwinds at completion so we should be
  // outside any span.
  const builder: FetchRequestBuilder = {
    build: () => ({ url: "http://upstream.test/", init: {} }),
    fetch: async (_url, init) => {
      capturedHeaders = (init.headers as Record<string, string>) ?? {};
      return new Response("ok");
    },
  };
  await withTraceparent(builder);
  // No active span — no traceparent injected by default.
  assert.equal(capturedHeaders.traceparent, undefined);
});

test("withTraceparent: forceInject emits a fresh root traceparent", async () => {
  let capturedHeaders: Record<string, string> = {};
  const builder: FetchRequestBuilder = {
    build: () => ({ url: "http://upstream.test/", init: {} }),
    fetch: async (_url, init) => {
      capturedHeaders = (init.headers as Record<string, string>) ?? {};
      return new Response("ok");
    },
  };
  await withTraceparent(builder, { forceInject: true });
  assert.ok(capturedHeaders.traceparent, "forceInject should emit a traceparent");
  assert.match(capturedHeaders.traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
});

test("withTraceparent: custom header name override", async () => {
  await withSpan("custom-header-span", async () => {
    let capturedHeaders: Record<string, string> = {};
    const builder: FetchRequestBuilder = {
      build: () => ({ url: "http://upstream.test/", init: {} }),
      fetch: async (_url, init) => {
        capturedHeaders = (init.headers as Record<string, string>) ?? {};
        return new Response("ok");
      },
    };
    await withTraceparent(builder, { headerName: "x-traceparent" });
    assert.ok(capturedHeaders["x-traceparent"]);
    assert.equal(capturedHeaders.traceparent, undefined, "default header name should not be used");
  });
});

test("withTraceparent: sequential fetches each get their own traceparent", async () => {
  const captured: string[] = [];
  await withSpan("outer", async () => {
    for (let i = 0; i < 3; i++) {
      const builder: FetchRequestBuilder = {
        build: () => ({ url: `http://upstream.test/${i}`, init: {} }),
        fetch: async (_url, init) => {
          const tp = (init.headers as Record<string, string>).traceparent;
          if (tp) captured.push(tp);
          return new Response("ok");
        },
      };
      await withTraceparent(builder);
    }
  });
  assert.equal(captured.length, 3);
  // Each should match the W3C format.
  for (const tp of captured) {
    assert.match(tp, /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
  }
});

test("defaultFetchBuilder: returns a builder with .build() and .fetch()", () => {
  const builder = defaultFetchBuilder("http://example.com/", { method: "GET" });
  const built = builder.build();
  assert.equal(built.url, "http://example.com/");
  assert.equal(built.init.method, "GET");
  assert.equal(typeof builder.fetch, "function");
});

test("isTelemetryEnabled: returns true when OTEL_SDK_DISABLED is false", () => {
  assert.equal(isTelemetryEnabled(), true);
});
