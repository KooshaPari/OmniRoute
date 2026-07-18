import test from "node:test";
import assert from "node:assert/strict";
import {
  recordTierDecision,
  recordReconcileSweep,
  renderPrometheusText,
  __resetMetricsForTests,
  listMetricSnapshots,
} from "../../open-sse/rpc/metrics.ts";

void test("otelBridge: recordTierDecision increments counter", () => {
  __resetMetricsForTests();
  recordTierDecision({
    edge: "sse.chunk.sseStream",
    oldTier: "T1",
    newTier: "T3",
    reason: "kill_switch",
    actor: "reconciler",
  });
  recordTierDecision({
    edge: "sse.chunk.sseStream",
    oldTier: "T1",
    newTier: "T3",
    reason: "kill_switch",
    actor: "reconciler",
  });
  const text = renderPrometheusText();
  assert.ok(text.includes("polyglot_tier_decisions_total"));
  assert.ok(text.includes('new_tier="T3"'));
});

void test("otelBridge: recordReconcileSweep records duration histogram", () => {
  __resetMetricsForTests();
  recordReconcileSweep({ durationMs: 2.4, sweptCount: 42, actor: "reconciler" });
  const text = renderPrometheusText();
  assert.ok(text.includes("polyglot_tier_decision_duration_us"));
  assert.ok(text.includes("polyglot_tier_decision_duration_us_bucket"));
});

void test("otelBridge: renderPrometheusText returns valid OpenMetrics", () => {
  __resetMetricsForTests();
  recordTierDecision({
    edge: "guardrails.pii.anonymize",
    oldTier: "T2",
    newTier: "T2",
    reason: "env_override",
    actor: "user",
  });
  recordTierDecision({
    edge: "scoring.combo.scoreSimd",
    oldTier: "T1",
    newTier: "T3",
    reason: "cpu_pressure_recovery",
    actor: "auto",
  });
  const text = renderPrometheusText();
  assert.ok(text.includes("# TYPE polyglot_tier_decisions_total counter"));
  assert.ok(text.includes('reason="env_override"'));
  assert.ok(text.includes('reason="cpu_pressure_recovery"'));
  assert.ok(text.endsWith("\n"));
});

void test("otelBridge: listMetricSnapshots returns enriched snapshot objects", () => {
  __resetMetricsForTests();
  recordTierDecision({
    edge: "test.edge",
    oldTier: "T1",
    newTier: "T2",
    reason: "env_override",
    actor: "user",
    elapsedMs: 1.5,
  });
  const snapshots = listMetricSnapshots();
  assert.ok(snapshots.length > 0);
  const counter = snapshots.find((s) => s.name === "polyglot_tier_decisions_total");
  assert.ok(counter, "should have counter snapshot");
  assert.equal(counter!.value, 1);
  const labels = counter!.labels ?? [];
  assert.ok(labels.some((l) => l.name === "reason" && l.value === "env_override"));
});

void test("otelBridge: recordTierDecision with empty object does not throw", () => {
  __resetMetricsForTests();
  recordTierDecision({} as never);
  const text = renderPrometheusText();
  assert.ok(text.length > 0);
});
