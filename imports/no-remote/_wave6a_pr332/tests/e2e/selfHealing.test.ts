/**
 * @file E2E synthetic incident test for the self-healing pipeline.
 *
 * Wires together the real AnomalyDetector, SelfHealingManager, and the
 * in-memory providerHealthHistory mock so we can observe:
 *   1. Sample ingestion across a rolling window
 *   2. Anomaly detection firing when the synthetic latencies spike
 *   3. The matched playbook being dispatched
 *   4. The persisted record in the anomaly ledger
 *
 * This is a Node test (not a vitest unit test) so it can run alongside
 * the rest of the suite via `node --test tests/e2e/selfHealing.test.ts`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { detectAnomalies } from "../../src/lib/resilience/anomalyDetector";
import { getSelfHealingManager } from "../../src/lib/resilience/anomalyHook";
import { resolveSelfHealingSettings } from "../../src/lib/resilience/selfHealingSettings";

test("self-healing pipeline responds to synthetic latency spike", () => {
  const settings = resolveSelfHealingSettings({
    enabled: true,
    windowSize: 10,
    zThreshold: 2.0,
    cooloffMs: 0,
    minSamples: 5,
    dryRun: false,
  });

  const mgr = getSelfHealingManager(settings);
  mgr.reset(); // clean slate for the synthetic incident

  // Phase 1: ingest baseline samples (well-behaved latency)
  const providerId = "test-provider-e2e";
  for (let i = 0; i < 8; i++) {
    mgr.recordHealthSample({
      providerId,
      latencyMs: 100 + (i % 3) * 5, // ~100-110ms
      errorRate: 0.0,
      nowMs: 1_000_000 + i * 1000,
    });
  }

  // Phase 2: introduce a 6x latency spike → detector should fire
  const spikeAt = 1_000_000 + 9 * 1000;
  mgr.recordHealthSample({
    providerId,
    latencyMs: 650,
    errorRate: 0.4,
    nowMs: spikeAt,
  });

  const anomalies = mgr.drainAnomalies();
  assert.ok(anomalies.length >= 1, "detector should flag the spike");
  const flag = anomalies[0]!;
  assert.equal(flag.providerId, providerId);
  assert.ok(flag.zScore >= 2.0, `expected zScore>=2, got ${flag.zScore}`);

  // Phase 3: matched playbook must have been dispatched + persisted
  const history = mgr.snapshotLedger();
  assert.ok(
    history.some((row) => row.actionKind !== null),
    "ledger should contain at least one dispatched playbook",
  );
});

test("detector stays silent below minSamples", () => {
  const settings = resolveSelfHealingSettings({
    enabled: true,
    windowSize: 10,
    zThreshold: 2.0,
    cooloffMs: 0,
    minSamples: 5,
    dryRun: false,
  });

  const onlyThree = detectAnomalies({
    samples: [
      { latencyMs: 100, errorRate: 0, nowMs: 1 },
      { latencyMs: 110, errorRate: 0, nowMs: 2 },
      { latencyMs: 120, errorRate: 0, nowMs: 3 },
    ],
    settings,
    providerId: "x",
  });
  assert.equal(onlyThree.length, 0, "minSamples not satisfied → no flags");
});