import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-bifrost-metrics-init-"));
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../../src/lib/db/core.ts");
const metrics = await import("../../../open-sse/observability/bifrostRouteMetrics.ts");

test.beforeEach(() => {
  metrics.resetBifrostRouteMetricsForTest();
  metrics.resetBifrostRouteMetricsHydrationStateForTest();
});

test.after(() => {
  metrics.resetBifrostRouteMetricsForTest();
  metrics.resetBifrostRouteMetricsHydrationStateForTest();
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });

  if (ORIGINAL_DATA_DIR === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  }
});

function makeTimestamp(offsetMs: number): number {
  return 1_700_000_000_000 + offsetMs;
}

test("does not hydrate bifrost route metrics at import time", () => {
  assert.equal(metrics.getBifrostRouteMetricsHydrationStateForTest(), "not_attempted");
  assert.equal(metrics.getBifrostRouteMetricsHydrationAttemptsForTest(), 0);
});

test("explicit startup-style hydration restores persisted samples and is idempotent", async () => {
  const base = makeTimestamp(100);
  const db = core.getDbInstance();
  db.prepare("DELETE FROM bifrost_route_metrics").run();

  metrics.recordBifrostRouteOutcome({
    provider: "openai",
    model: "gpt-4o-mini",
    status: 200,
    latencyMs: 100,
    timestampMs: base,
  });
  metrics.recordBifrostRouteOutcome({
    provider: "openai",
    model: "gpt-4o-mini",
    status: 500,
    latencyMs: 120,
    timestampMs: base + 1,
  });
  metrics.recordBifrostRouteOutcome({
    provider: "openai",
    model: "gpt-4o-mini",
    status: 200,
    latencyMs: 80,
    timestampMs: base + 2,
  });

  await metrics.flushBifrostRouteMetricsPersistenceForTest();

  metrics.resetBifrostRouteMetricsForTest();
  metrics.resetBifrostRouteMetricsHydrationStateForTest();

  metrics.initializeBifrostRouteMetricsFromStorage();
  assert.equal(metrics.getBifrostRouteMetricsHydrationStateForTest(), "hydrated");
  assert.equal(metrics.getBifrostRouteMetricsHydrationAttemptsForTest(), 1);

  const restored = metrics.getBifrostRouteMetrics("openai", "gpt-4o-mini");
  assert.notEqual(restored, null);
  assert.equal(restored?.sampleCount, 3);

  metrics.initializeBifrostRouteMetricsFromStorage();
  assert.equal(metrics.getBifrostRouteMetricsHydrationAttemptsForTest(), 1);
  assert.equal(metrics.getBifrostRouteMetrics("openai", "gpt-4o-mini")?.sampleCount, 3);
});
