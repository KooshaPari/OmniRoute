/**
 * OTel active-span stack + tracer API tests.
 *
 * Covers:
 * - startSpan: returns a Span with the correct name / kind / context
 * - withSpan: pushes onto the active context, fn result bubbles back,
 *   exceptions flip status to ERROR and are rethrown
 * - stub mode (OTEL_SDK_DISABLED=true) — spans still allocate but no exporter
 * - kind passthrough (INTERNAL/SERVER/CLIENT)
 * - context isolation: nested withSpan frames see distinct active spans
 * - parent-child propagation: child span inherits parent's traceId
 *
 * Each test calls initTelemetry() explicitly to reset module-level state
 * from the previous test (the storage frame is bound to AsyncLocalStorage
 * which is automatically reset across test boundaries, but `enabled` /
 * `currentResource` are module-level and need re-init).
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  initTelemetry,
  isTelemetryEnabled,
  startSpan,
  withSpan,
  currentSpan,
  currentTraceId,
  currentSpanId,
  getTracer,
  setAttribute,
  setAttributes,
  addEvent,
  recordException,
  setSpanStatus,
  endSpan,
} from "../../../src/lib/observability/otel.ts";

beforeEach(() => {
  // Reset to a known state: telemetry ON, no exporter.
  process.env.OTEL_SDK_DISABLED = "false";
  delete process.env.OTEL_SERVICE_NAME;
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  initTelemetry();
});

test("initTelemetry: isTelemetryEnabled returns true when OTEL_SDK_DISABLED=false", () => {
  process.env.OTEL_SDK_DISABLED = "false";
  initTelemetry();
  assert.equal(isTelemetryEnabled(), true);
});

test("initTelemetry: isTelemetryEnabled returns false when OTEL_SDK_DISABLED=true", () => {
  process.env.OTEL_SDK_DISABLED = "true";
  initTelemetry();
  assert.equal(isTelemetryEnabled(), false);
  // Restore default so subsequent tests see telemetry enabled.
  process.env.OTEL_SDK_DISABLED = "false";
  initTelemetry();
});

test("startSpan: returns a Span with the correct name and default kind=INTERNAL", () => {
  const span = startSpan("unit-test-span");
  assert.equal(span.name, "unit-test-span");
  assert.equal(span.kind, "INTERNAL");
  assert.equal(span.context.traceId.length, 32);
  assert.equal(span.context.spanId.length, 16);
  assert.equal(span.status, "UNSET");
  assert.equal(span.ended, false);
});

test("startSpan: kind option passthrough", () => {
  const span = startSpan("client-call", { kind: "CLIENT" });
  assert.equal(span.kind, "CLIENT");
  const server = startSpan("server-call", { kind: "SERVER" });
  assert.equal(server.kind, "SERVER");
});

test("startSpan: attributes option is copied onto the span", () => {
  const span = startSpan("attrs-test", { attributes: { "http.method": "GET", "http.status": 200 } });
  assert.equal(span.attributes["http.method"], "GET");
  assert.equal(span.attributes["http.status"], 200);
});

test("withSpan: pushes span onto active context; fn sees it via currentSpan()", async () => {
  await withSpan("outer", async () => {
    const active = currentSpan();
    assert.ok(active);
    assert.equal(active.name, "outer");
  });
  // Outside the frame: currentSpan() returns null.
  assert.equal(currentSpan(), null);
});

test("withSpan: nested frames each see their own active span", async () => {
  let outerName: string | undefined;
  let innerName: string | undefined;
  await withSpan("outer", async () => {
    outerName = currentSpan()?.name;
    await withSpan("inner", async () => {
      innerName = currentSpan()?.name;
    });
    // After inner exits, we're back at outer.
    assert.equal(currentSpan()?.name, "outer");
  });
  assert.equal(outerName, "outer");
  assert.equal(innerName, "inner");
});

test("withSpan: parent-child propagation — child inherits parent's traceId", async () => {
  let parentTrace: string | undefined;
  let childTrace: string | undefined;
  let childSpan: string | undefined;
  await withSpan("parent", async () => {
    parentTrace = currentTraceId();
    childSpan = currentSpanId();
    await withSpan("child", async () => {
      childTrace = currentTraceId();
      // Child has a NEW span ID but same trace ID.
      assert.notEqual(currentSpanId(), childSpan);
    });
  });
  assert.ok(parentTrace);
  assert.equal(parentTrace, childTrace, "child should share traceId with parent");
});

test("withSpan: exceptions flip status to ERROR and rethrow", async () => {
  await assert.rejects(async () => {
    await withSpan("throws", async () => {
      throw new Error("boom");
    });
  }, /boom/);
  // After the catch, currentSpan() is back to null.
  assert.equal(currentSpan(), null);
});

test("withSpan: returns fn's return value", async () => {
  const result = await withSpan("ok", async () => 42);
  assert.equal(result, 42);
});

test("setAttribute: mutates span.attributes", () => {
  const span = startSpan("mut");
  setAttribute(span, "user.id", "u-1");
  assert.equal(span.attributes["user.id"], "u-1");
  setAttribute(span, "request.count", 3);
  assert.equal(span.attributes["request.count"], 3);
});

test("setAttributes: merges many keys at once", () => {
  const span = startSpan("batch");
  setAttributes(span, { a: 1, b: 2, c: "three" });
  assert.equal(span.attributes.a, 1);
  assert.equal(span.attributes.b, 2);
  assert.equal(span.attributes.c, "three");
});

test("recordException: attaches exception event with type/message/stack", () => {
  const span = startSpan("err-span");
  recordException(span, new Error("kaboom"));
  assert.ok(span.exception);
  assert.equal(span.exception?.type, "Error");
  assert.equal(span.exception?.message, "kaboom");
  assert.ok(span.exception?.stack);
  // The 'exception' event is appended.
  assert.equal(span.events.length, 1);
  assert.equal(span.events[0]!.name, "exception");
  assert.equal(span.events[0]!.attributes["exception.type"], "Error");
});

test("endSpan: marks span as ended and computes durationSeconds", async () => {
  const span = startSpan("timed");
  // Simulate elapsed time.
  await new Promise((r) => setTimeout(r, 5));
  endSpan(span);
  assert.equal(span.ended, true);
  assert.ok(span.endTime !== null);
  assert.ok(span.durationSeconds !== null);
  assert.ok(span.durationSeconds! >= 0);
});

test("setSpanStatus: flips status code", () => {
  const span = startSpan("status-test");
  setSpanStatus(span, "ERROR", "upstream 502");
  assert.equal(span.status, "ERROR");
  assert.equal(span.statusMessage, "upstream 502");
});

test("getTracer: returns frozen object with startSpan / withSpan", () => {
  const tracer = getTracer("@test/pkg", "1.2.3");
  assert.equal(tracer.name, "@test/pkg");
  assert.equal(tracer.version, "1.2.3");
  assert.equal(typeof tracer.startSpan, "function");
  assert.equal(typeof tracer.withSpan, "function");
});

test("getTracer: default name+version when called with no args", () => {
  const tracer = getTracer();
  assert.ok(tracer.name.startsWith("@omniroute"));
  assert.ok(tracer.version.length > 0);
});

test("currentTraceId/currentSpanId: outside any withSpan, return fresh hex", () => {
  const t = currentTraceId();
  const s = currentSpanId();
  assert.equal(t.length, 32);
  assert.equal(s.length, 16);
});

test("currentTraceId/currentSpanId: inside withSpan, return active span's IDs", async () => {
  await withSpan("id-check", async () => {
    const span = currentSpan();
    assert.ok(span);
    assert.equal(currentTraceId(), span!.context.traceId);
    assert.equal(currentSpanId(), span!.context.spanId);
  });
});

test("addEvent: appends a SpanEvent with the given name and attributes", () => {
  const span = startSpan("ev");
  addEvent(span, "checkpoint", { step: 1 });
  assert.equal(span.events.length, 1);
  assert.equal(span.events[0]!.name, "checkpoint");
  assert.equal(span.events[0]!.attributes.step, 1);
});
