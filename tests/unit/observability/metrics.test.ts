/**
 * Metrics registry + domain recorders tests.
 *
 * Covers:
 * - Counter: inc, reset, throws on negative inc, cardinality cap drops
 * - Gauge: set / inc / dec
 * - Histogram: observe, bucket counts, sum/count
 * - Summary: observe, quantile computation
 * - MetricsRegistry: register / get / render
 * - recordProviderAttempt / recordProviderDuration / recordCacheHit /
 *   recordCacheMiss / recordQuotaRemaining / recordQuotaLimit /
 *   setProcessMetrics — happy paths + label propagation
 *
 * Each test calls `metricsRegistry().reset()` to avoid cross-test bleed.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  Counter,
  Gauge,
  Histogram,
  Summary,
  MetricsRegistry,
  metricsRegistry,
  httpMetricsMiddleware,
  recordProviderAttempt,
  recordProviderDuration,
  recordCacheHit,
  recordCacheMiss,
  recordQuotaRemaining,
  recordQuotaLimit,
  setProcessMetrics,
  MAX_LABEL_VALUES,
} from "../../../src/lib/observability/metrics.ts";

beforeEach(() => {
  metricsRegistry().reset();
});

test("Counter: inc() accumulates per label set", () => {
  const c = new Counter("test_counter", "Test counter", ["kind"]);
  c.inc(1, { kind: "a" });
  c.inc(2, { kind: "a" });
  c.inc(1, { kind: "b" });
  const all = Array.from(c.samples.values());
  assert.equal(all.length, 2);
  assert.equal(all.find((s) => s.labels.kind === "a")?.value, 3);
  assert.equal(all.find((s) => s.labels.kind === "b")?.value, 1);
});

test("Counter: throws on negative inc", () => {
  const c = new Counter("neg", "negative test");
  assert.throws(() => c.inc(-1), /cannot decrement/i);
});

test("Counter: respects cardinality cap and increments dropped counter", () => {
  const c = new Counter("cap", "cap test", ["kind"], { cardinalityCap: 3 });
  c.inc(1, { kind: "a" });
  c.inc(1, { kind: "b" });
  c.inc(1, { kind: "c" });
  // Fourth sample dropped.
  c.inc(1, { kind: "d" });
  assert.equal(c.samples.size, 3);
  // Render shows the dropped hint.
  assert.match(c.render(), /dropped_series_total/);
});

test("Counter: render emits HELP + TYPE + sample lines", () => {
  const c = new Counter("r", "help text", ["k"]);
  c.inc(7, { k: "v1" });
  const out = c.render();
  assert.match(out, /^# HELP r help text/m);
  assert.match(out, /^# TYPE r counter/m);
  assert.match(out, /r\{k="v1"\} 7/);
});

test("Gauge: set / inc / dec", () => {
  const g = new Gauge("g", "gauge test", ["x"]);
  g.set(10, { x: "a" });
  g.inc(5, { x: "a" });
  g.dec(2, { x: "a" });
  const s = Array.from(g.samples.values()).find((s) => s.labels.x === "a");
  assert.equal(s?.value, 13);
});

test("Histogram: observe increments cumulative bucket counts and sum/count", () => {
  const h = new Histogram("latency", "test", ["op"], { buckets: [0.1, 0.5, 1] });
  h.observe(0.05, { op: "x" }); // bucket 0.1, 0.5, 1 (cumulative)
  h.observe(0.3, { op: "x" });  // bucket 0.5, 1
  h.observe(2, { op: "x" });    // no finite bucket, only +Inf
  const counts = h.bucketCounts.get("x")!;
  assert.equal(counts.get(0.1), 1);
  assert.equal(counts.get(0.5), 2);
  assert.equal(counts.get(1), 2);
  assert.equal(counts.get(Number.POSITIVE_INFINITY), 3);
  assert.equal(h.sumByLabel.get("x"), 0.05 + 0.3 + 2);
  assert.equal(h.countByLabel.get("x"), 3);
});

test("Histogram: render emits _bucket / _sum / _count", () => {
  const h = new Histogram("h", "h help", ["k"], { buckets: [1, 2] });
  h.observe(1.5, { k: "v" });
  const out = h.render();
  assert.match(out, /^# TYPE h histogram/m);
  assert.match(out, /h_bucket\{k="v",le="1"\}/);
  assert.match(out, /h_bucket\{k="v",le="2"\}/);
  assert.match(out, /h_bucket\{k="v",le="\+Inf"\}/);
  assert.match(out, /h_sum\{k="v"\}/);
  assert.match(out, /h_count\{k="v"\}/);
});

test("Summary: observe + render emits quantile lines", () => {
  const s = new Summary("lat", "summary test", ["k"], { maxAge: 100 });
  for (const v of [0.1, 0.5, 1, 2, 5]) s.observe(v, { k: "v" });
  const out = s.render();
  assert.match(out, /^# TYPE lat summary/m);
  assert.match(out, /lat\{k="v",quantile="0\.5"\}/);
  assert.match(out, /lat\{k="v",quantile="0\.9"\}/);
  assert.match(out, /lat\{k="v",quantile="0\.99"\}/);
  assert.match(out, /lat_sum/);
  assert.match(out, /lat_count/);
});

test("MetricsRegistry: register + get + render", () => {
  const reg = new MetricsRegistry();
  const c = new Counter("c", "help");
  reg.register(c);
  assert.strictEqual(reg.get("c"), c);
  c.inc(3);
  assert.match(reg.render(), /c 3/);
});

test("MetricsRegistry: register returns existing metric on duplicate name", () => {
  const reg = new MetricsRegistry();
  const a = reg.register(new Counter("x", "first"));
  const b = reg.register(new Counter("x", "second"));
  assert.strictEqual(a, b);
});

test("MAX_LABEL_VALUES: defaults to 64", () => {
  assert.equal(MAX_LABEL_VALUES, 64);
});

test("metricsRegistry(): singleton is stable", () => {
  const a = metricsRegistry();
  const b = metricsRegistry();
  assert.strictEqual(a, b);
  // Default registry includes process_* gauges.
  assert.ok(a.get("process_uptime_seconds"));
});

test("httpMetricsMiddleware: increments counter and observes histogram", () => {
  httpMetricsMiddleware({ route: "/v1/chat", method: "POST", status: 200, durationSeconds: 0.123 });
  const out = metricsRegistry().render();
  assert.match(out, /http_requests_total\{[^}]*route="\/v1\/chat"[^}]*\} 1/);
  assert.match(out, /http_request_duration_seconds_bucket/);
});

test("recordProviderAttempt: emits provider_attempts_total with outcome label", () => {
  recordProviderAttempt({ provider: "openai", model: "gpt-4o", outcome: "success" });
  const out = metricsRegistry().render();
  assert.match(out, /provider_attempts_total\{[^}]*outcome="success"[^}]*\} 1/);
});

test("recordProviderDuration: emits provider_call_duration_seconds_bucket", () => {
  recordProviderDuration({ provider: "openai", model: "gpt-4o", durationSeconds: 0.45 });
  const out = metricsRegistry().render();
  assert.match(out, /provider_call_duration_seconds_bucket/);
});

test("recordCacheHit / recordCacheMiss: emit layer label", () => {
  recordCacheHit("prompt");
  recordCacheHit("prompt");
  recordCacheMiss("prompt");
  const out = metricsRegistry().render();
  assert.match(out, /cache_hits_total\{layer="prompt"\} 2/);
  assert.match(out, /cache_misses_total\{layer="prompt"\} 1/);
});

test("recordQuotaRemaining / recordQuotaLimit: emit tenant label", () => {
  recordQuotaRemaining("tenant-a", 42);
  recordQuotaLimit("tenant-a", 100);
  const out = metricsRegistry().render();
  assert.match(out, /quota_remaining\{tenant="tenant-a"\} 42/);
  assert.match(out, /quota_limit\{tenant="tenant-a"\} 100/);
});

test("setProcessMetrics: refreshes process_* gauges without throwing", () => {
  setProcessMetrics();
  const out = metricsRegistry().render();
  assert.match(out, /process_uptime_seconds /);
  assert.match(out, /process_memory_rss_bytes /);
  assert.match(out, /process_memory_heap_bytes /);
  assert.match(out, /process_event_loop_lag_seconds /);
});
