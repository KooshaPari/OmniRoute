/**
 * tests/unit/observability/quota-gauges.test.ts
 *
 * PR-007 quota-gauges tests. Verifies the task-spec API surface:
 *   - setQuotaRemaining / setQuotaLimit round-trip into the gauges
 *   - getQuotaSnapshot returns the per-kind breakdown
 *   - kind allow-list enforced (unknown kinds → "other")
 *   - utilization ratio computed correctly (1 - remaining/limit)
 *   - resetForTests wipes the snapshot map
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  setQuotaRemaining,
  setQuotaLimit,
  getQuotaSnapshot,
  resetForTests,
} from "../../../src/lib/observability/quotaGauges";
import {
  quotaRemainingGauge,
  quotaLimitGauge,
  quotaUtilizationGauge,
  metricsRegistry,
} from "../../../src/lib/observability/metrics";

function resetAll(): void {
  resetForTests();
  metricsRegistry.reset();
}

test("quota-gauges: setRemaining + setLimit round-trip into the gauges", () => {
  resetAll();
  setQuotaRemaining("t-q1", "requests_per_minute", 42);
  setQuotaLimit("t-q1", "requests_per_minute", 100);
  // Underlying gauges hold the exact values.
  assert.equal(
    quotaRemainingGauge.get({ tenant_id: "t-q1", kind: "requests_per_minute" }),
    42
  );
  assert.equal(
    quotaLimitGauge.get({ tenant_id: "t-q1", kind: "requests_per_minute" }),
    100
  );
});

test("quota-gauges: getQuotaSnapshot returns the per-kind breakdown", () => {
  resetAll();
  setQuotaRemaining("t-q2", "requests_per_minute", 30);
  setQuotaLimit("t-q2", "requests_per_minute", 60);
  setQuotaRemaining("t-q2", "tokens_per_day", 8000);
  setQuotaLimit("t-q2", "tokens_per_day", 10_000);
  const snap = getQuotaSnapshot("t-q2");
  assert.equal(snap.tenantId, "t-q2");
  // Per-kind snapshots are returned in declaration order.
  assert.equal(snap.kinds.length, 2);
  const rpm = snap.kinds.find((k) => k.kind === "requests_per_minute")!;
  assert.equal(rpm.remaining, 30);
  assert.equal(rpm.limit, 60);
  assert.ok(Math.abs(rpm.utilizationRatio - 0.5) < 1e-9);
  const tpd = snap.kinds.find((k) => k.kind === "tokens_per_day")!;
  assert.equal(tpd.remaining, 8000);
  assert.equal(tpd.limit, 10_000);
  assert.ok(Math.abs(tpd.utilizationRatio - 0.2) < 1e-9);
});

test("quota-gauges: kind allow-list enforced (unknown kind → 'other')", () => {
  resetAll();
  setQuotaRemaining("t-q3", "completely-not-a-kind", 5);
  setQuotaLimit("t-q3", "completely-not-a-kind", 10);
  // The metric label is "other", not the input.
  assert.equal(
    quotaRemainingGauge.get({ tenant_id: "t-q3", kind: "other" }),
    5
  );
  assert.equal(
    quotaLimitGauge.get({ tenant_id: "t-q3", kind: "other" }),
    10
  );
  // Snapshot should bucket it under "other".
  const snap = getQuotaSnapshot("t-q3");
  assert.equal(snap.kinds.length, 1);
  assert.equal(snap.kinds[0].kind, "other");
});

test("quota-gauges: utilization ratio = 1 - remaining/limit; >1 for overflow; 0 when limit=0", () => {
  resetAll();
  // Normal case: 30 remaining, 60 limit → 50% utilisation.
  setQuotaRemaining("t-q4", "requests_per_day", 30);
  setQuotaLimit("t-q4", "requests_per_day", 60);
  assert.ok(
    Math.abs(quotaUtilizationGauge.get({ tenant_id: "t-q4", kind: "requests_per_day" }) - 0.5) < 1e-9
  );
  // Overflow: remaining below zero would be clamped, but if we explicitly
  // set remaining=0 with limit=10, utilisation = 100%.
  setQuotaRemaining("t-q4-overflow", "requests_per_day", 0);
  setQuotaLimit("t-q4-overflow", "requests_per_day", 10);
  assert.equal(
    quotaUtilizationGauge.get({ tenant_id: "t-q4-overflow", kind: "requests_per_day" }),
    1
  );
  // limit=0 → utilisation stays at 0 (never +Infinity).
  setQuotaRemaining("t-q4-zero", "spend_per_day_usd", 5);
  setQuotaLimit("t-q4-zero", "spend_per_day_usd", 0);
  assert.equal(
    quotaUtilizationGauge.get({ tenant_id: "t-q4-zero", kind: "spend_per_day_usd" }),
    0
  );
});

test("quota-gauges: resetForTests wipes the snapshot map", () => {
  resetAll();
  setQuotaRemaining("t-q5", "requests_per_minute", 10);
  setQuotaLimit("t-q5", "requests_per_minute", 20);
  assert.equal(getQuotaSnapshot("t-q5").kinds.length, 1);
  resetForTests();
  assert.equal(getQuotaSnapshot("t-q5").kinds.length, 0);
});

test("quota-gauges: empty snapshot for unknown tenant", () => {
  resetAll();
  const snap = getQuotaSnapshot("t-unknown");
  assert.equal(snap.tenantId, "t-unknown");
  assert.equal(snap.kinds.length, 0);
  assert.equal(snap.remaining, undefined);
  assert.equal(snap.limit, undefined);
});
