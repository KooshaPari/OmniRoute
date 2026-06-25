/**
 * Auto-instrumentation helpers tests.
 *
 * Covers:
 * - isKnownCacheLayer: returns true for known layers, false for unknown
 * - instrumentFetch: produces a CLIENT span, captures status code from a
 *   Response, records http_metrics_middleware on the way out, exception
 *   path flips status to ERROR
 * - instrumentDb: produces an INTERNAL span with db.operation attribute
 * - instrumentCache: hit (mode 1 + mode 2) emits cache_hits_total; miss
 *   emits cache_misses_total
 * - instrumentProvider: success/error/timeout/rate_limited outcomes
 * - recordExceptionSafe: tolerates null/undefined span without throwing
 * - logWithTrace: attaches traceId/spanId to the log record
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  instrumentFetch,
  instrumentDb,
  instrumentCache,
  instrumentProvider,
  isKnownCacheLayer,
  recordExceptionSafe,
  logWithTrace,
  KNOWN_CACHE_LAYERS,
} from "../../../src/lib/observability/auto.ts";
import { metricsRegistry } from "../../../src/lib/observability/metrics.ts";
import { setSink, type LogRecord } from "../../../src/lib/observability/logger.ts";
import { initTelemetry, currentSpan } from "../../../src/lib/observability/otel.ts";

beforeEach(() => {
  metricsRegistry().reset();
  process.env.OTEL_SDK_DISABLED = "false";
  initTelemetry();
});

test("isKnownCacheLayer: returns true for the canonical cache layers", () => {
  for (const layer of KNOWN_CACHE_LAYERS) {
    assert.equal(isKnownCacheLayer(layer), true, `${layer} should be known`);
  }
});

test("isKnownCacheLayer: returns false for unknown layer names", () => {
  assert.equal(isKnownCacheLayer("user-id"), false);
  assert.equal(isKnownCacheLayer(""), false);
  assert.equal(isKnownCacheLayer("PROMPT"), false, "case-sensitive");
});

test("instrumentFetch: produces a CLIENT span with kind=CLIENT", async () => {
  let capturedKind: string | undefined;
  await instrumentFetch({ kind: "test-fetch" }, async (span) => {
    capturedKind = span.kind;
    return new Response("ok", { status: 200 });
  });
  assert.equal(capturedKind, "CLIENT");
});

test("instrumentFetch: records http_metrics_middleware on the response path", async () => {
  await instrumentFetch({ kind: "t", attributes: { route: "/api/foo", "http.method": "POST" } }, async () => {
    return new Response("ok", { status: 200, url: "http://x.test/api/foo" });
  });
  const out = metricsRegistry().render();
  assert.match(out, /http_requests_total\{[^}]*route="\/api\/foo"[^}]*status="200"[^}]*\} 1/);
});

test("instrumentFetch: exception path still records metrics (status=0) and rethrows", async () => {
  await assert.rejects(async () => {
    await instrumentFetch({ kind: "t", attributes: { route: "/x", "http.method": "GET" } }, async () => {
      throw new Error("kaboom");
    });
  }, /kaboom/);
  const out = metricsRegistry().render();
  assert.match(out, /http_requests_total\{[^}]*status="0"[^}]*\} 1/);
});

test("instrumentDb: produces an INTERNAL span with db.operation attribute", async () => {
  let op: string | undefined;
  await instrumentDb({ op: "select", table: "users" }, async (span) => {
    op = span.attributes["db.operation"] as string | undefined;
    assert.equal(span.kind, "INTERNAL");
    return [];
  });
  assert.equal(op, "select");
});

test("instrumentCache: mode-1 (hit) records cache_hits_total", async () => {
  await instrumentCache({ layer: "prompt" }, async () => ({ hit: true, value: "v" }));
  const out = metricsRegistry().render();
  assert.match(out, /cache_hits_total\{layer="prompt"\} 1/);
});

test("instrumentCache: mode-1 (miss) records cache_misses_total", async () => {
  await instrumentCache({ layer: "prompt" }, async () => ({ hit: false, value: undefined as unknown as undefined }));
  const out = metricsRegistry().render();
  assert.match(out, /cache_misses_total\{layer="prompt"\} 1/);
});

test("instrumentCache: mode-2 (null → miss, value → hit)", async () => {
  await instrumentCache({ layer: "embedding" }, async () => null);
  await instrumentCache({ layer: "embedding" }, async () => "non-null-value");
  const out = metricsRegistry().render();
  assert.match(out, /cache_misses_total\{layer="embedding"\} 1/);
  assert.match(out, /cache_hits_total\{layer="embedding"\} 1/);
});

test("instrumentProvider: success outcome for status < 400", async () => {
  await instrumentProvider({ provider: "openai", model: "gpt-4o" }, async () => new Response("ok", { status: 200 }));
  const out = metricsRegistry().render();
  assert.match(out, /provider_attempts_total\{[^}]*outcome="success"[^}]*\} 1/);
});

test("instrumentProvider: rate_limited outcome for 429", async () => {
  await instrumentProvider({ provider: "openai", model: "gpt-4o" }, async () => new Response("x", { status: 429 }));
  const out = metricsRegistry().render();
  assert.match(out, /provider_attempts_total\{[^}]*outcome="rate_limited"[^}]*\} 1/);
});

test("instrumentProvider: error outcome for status >= 400 and rethrow on throw", async () => {
  await instrumentProvider({ provider: "anthropic", model: "claude-3" }, async () => new Response("x", { status: 500 }));
  await assert.rejects(async () => {
    await instrumentProvider({ provider: "anthropic", model: "claude-3" }, async () => {
      throw new Error("upstream down");
    });
  }, /upstream down/);
  const out = metricsRegistry().render();
  assert.match(out, /provider_attempts_total\{[^}]*outcome="error"[^}]*\} 2/);
});

test("recordExceptionSafe: tolerates null/undefined span without throwing", () => {
  // Should not throw.
  recordExceptionSafe(null, new Error("x"));
  recordExceptionSafe(undefined, "string-err");
  assert.ok(true, "no throw");
});

test("logWithTrace: attaches current traceId/spanId to log record", () => {
  let captured: LogRecord[] = [];
  const prev = setSink((r) => captured.push(r));
  try {
    initTelemetry();
    logWithTrace(undefined, "boundary-log", { kind: "auth" });
    assert.equal(captured.length, 1);
    const r = captured[0]!;
    assert.ok(r.traceId);
    assert.ok(r.spanId);
    assert.equal(r.kind, "auth");
    assert.equal(r.msg, "boundary-log");
  } finally {
    setSink(prev);
  }
});

test("logWithTrace: outside any active span, still attaches a fallback traceId", () => {
  let captured: LogRecord[] = [];
  const prev = setSink((r) => captured.push(r));
  try {
    // Ensure no active span is in scope.
    assert.equal(currentSpan(), null);
    logWithTrace(undefined, "no-span-log");
    assert.equal(captured.length, 1);
    const r = captured[0]!;
    assert.ok(r.traceId);
    assert.equal((r.traceId as string).length, 32);
  } finally {
    setSink(prev);
  }
});
