/**
 * Tests for the Prometheus-shaped metrics sink in `open-sse/rpc/metrics.ts`.
 *
 * Verifies:
 *   - `recordTierDecision` increments counters under correct label buckets
 *   - `renderPrometheusText` emits HELP/TYPE headers + correctly escaped labels
 *   - `__resetMetricsForTests` clears state between tests
 *   - The `/metrics` endpoint exposes the expected OpenMetrics surface
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recordTierDecision,
  renderPrometheusText,
  __resetMetricsForTests,
  startMetricsEndpoint,
} from "../../open-sse/rpc/metrics.ts";

test.beforeEach(() => {
  __resetMetricsForTests();
});

test("recordTierDecision: increments counter for (old,new,reason,actor,edge)", () => {
  recordTierDecision({
    edge: "scoring.combo.scoreSimd",
    oldTier: "T3",
    newTier: "T1",
    reason: "kill_switch_tripped",
    actor: "polyglot_reconciler",
    elapsedMs: 5.2,
  });
  recordTierDecision({
    edge: "scoring.combo.scoreSimd",
    oldTier: "T3",
    newTier: "T1",
    reason: "kill_switch_tripped",
    actor: "polyglot_reconciler",
    elapsedMs: 6.1,
  });
  const text = renderPrometheusText();
  assert.match(text, /# TYPE polyglot_tier_decisions_total counter/);
  assert.match(
    text,
    /polyglot_tier_decisions_total\{[^}]*old_tier="T3"[^}]*new_tier="T1"[^}]*\} 2/
  );
});

test("recordTierDecision: buckets latency observations per (edge, new_tier)", () => {
  recordTierDecision({
    edge: "sse.chunk.sseStream",
    oldTier: "T3",
    newTier: "T2",
    reason: "cpu_pressure",
    actor: "polyglot_reconciler",
    elapsedMs: 0.005, // 5 µs
  });
  recordTierDecision({
    edge: "sse.chunk.sseStream",
    oldTier: "T3",
    newTier: "T2",
    reason: "cpu_pressure",
    actor: "polyglot_reconciler",
    elapsedMs: 8.5, // 8500 µs
  });
  const text = renderPrometheusText();
  assert.match(text, /# TYPE polyglot_tier_decision_duration_us histogram/);
  // 5 µs falls in le="10" and up; 8500 µs falls only in le="10000" and +Inf
  // So le="10" should have count 1 (the 5µs sample).
  assert.match(text, /polyglot_tier_decision_duration_us_bucket\{[^}]*le="10"[^}]*\} 1/);
  assert.match(text, /polyglot_tier_decision_duration_us_bucket\{[^}]*le="\+Inf"[^}]*\} 2/);
});

test("renderPrometheusText: escapes quotes + newlines in label values", () => {
  recordTierDecision({
    edge: 'edge\nwith"bad\nchars',
    oldTier: "T1",
    newTier: "T3",
    reason: 'reason"with"quotes',
    actor: "polyglot_reconciler",
  });
  const text = renderPrometheusText();
  // Quotes escaped, newlines escaped
  assert.match(text, /edge\\nwith\\"bad\\nchars/);
  assert.match(text, /reason\\"with\\"quotes/);
  // No raw newlines inside label values
  assert.doesNotMatch(
    text,
    /\{[^}]*\n[^}]*\}/
  );
});

test("renderPrometheusText: emits empty counters when no decisions recorded", () => {
  const text = renderPrometheusText();
  assert.match(text, /# HELP polyglot_tier_decisions_total/);
  assert.match(text, /# TYPE polyglot_tier_decisions_total counter/);
  // No data lines for the counter
  assert.doesNotMatch(text, /^polyglot_tier_decisions_total\{/m);
});

test("recordTierDecision: never throws even with malformed input", () => {
  // The wrapper is `try/catch`-all per the spec — metrics are best-effort.
  assert.doesNotThrow(() => {
    recordTierDecision({
      edge: undefined as unknown as string,
      oldTier: null,
      newTier: "T3",
      reason: "default",
      actor: "polyglot_reconciler",
    });
  });
});

test("startMetricsEndpoint: returns null when port is out of range", async () => {
  process.env.OMNIROUTE_METRICS_PORT = "99999";
  const result = await startMetricsEndpoint();
  assert.equal(result, null);
  delete process.env.OMNIROUTE_METRICS_PORT;
});

test("startMetricsEndpoint: serves /metrics text on a real port", async () => {
  // Pick a random port in the dynamic range.
  process.env.OMNIROUTE_METRICS_PORT = "0"; // OS assigns ephemeral
  delete process.env.OMNIROUTE_METRICS_HOST;
  // Spawn server on a fixed port instead
  process.env.OMNIROUTE_METRICS_PORT = "19095";
  recordTierDecision({
    edge: "test.edge",
    oldTier: null,
    newTier: "T3",
    reason: "default",
    actor: "test",
  });
  const server = await startMetricsEndpoint();
  if (server) {
    const res = await fetch(`http://127.0.0.1:${server.port}/metrics`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /# HELP polyglot_tier_decisions_total/);
    assert.match(text, /polyglot_tier_decisions_total\{[^}]*edge="test\.edge"/);
    await server.close();
  }
  delete process.env.OMNIROUTE_METRICS_PORT;
  __resetMetricsForTests();
});