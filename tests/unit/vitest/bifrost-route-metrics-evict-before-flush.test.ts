import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-bifrost-metrics-evict-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../../src/lib/db/core.ts");
const metricsPersistence = await import("../../../src/lib/db/bifrostRouteMetrics.ts");
const metrics = await import("../../../open-sse/observability/bifrostRouteMetrics.ts");

function makeTimestamp(offsetMs: number): number {
  return 1_700_000_000_000 + offsetMs;
}

function clearPersistedMetrics(): void {
  const db = core.getDbInstance();
  try {
    db.prepare("DELETE FROM bifrost_route_metrics").run();
  } catch {
    /* ignore */
  }
}

function resetForTest(): void {
  metrics.resetBifrostRouteMetricsForTest();
  metrics.resetBifrostRouteMetricsHydrationStateForTest();
  clearPersistedMetrics();
}

describe("bifrostRouteMetrics persistence flush", () => {
  beforeEach(() => {
    resetForTest();
  });

  afterEach(() => {
    resetForTest();
  });

  afterAll(() => {
    core.resetDbInstance();
    metrics.resetBifrostRouteMetricsForTest();
    metrics.resetBifrostRouteMetricsHydrationStateForTest();
    try {
      core.resetDbInstance();
    } catch {
      /* ignore */
    }
    clearPersistedMetrics();
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("persists an evicted dirty key by flushing pending snapshot data", async () => {
    metrics.recordBifrostRouteOutcome({
      provider: "provider-0",
      model: "model",
      status: 200,
      latencyMs: 12,
      timestampMs: makeTimestamp(10_000),
    });

    for (let idx = 1; idx <= 512; idx += 1) {
      metrics.recordBifrostRouteOutcome({
        provider: `provider-${idx}`,
        model: "model",
        status: 200,
        latencyMs: 11,
        timestampMs: makeTimestamp(idx),
      });
    }

    await metrics.flushBifrostRouteMetricsPersistenceForTest();

    metrics.resetBifrostRouteMetricsForTest();
    metrics.hydrateBifrostRouteMetricsFromStorageForTest();

    expect(metrics.getBifrostRouteMetrics("provider-0", "model")).not.toBeNull();
    expect(metrics.getBifrostRouteMetrics("provider-0", "model")?.sampleCount).toBe(1);
    expect(metrics.getBifrostRouteMetrics("provider-0", "model")?.lastStatus).toBe(200);

    const loaded = metricsPersistence.loadBifrostRouteMetricSamples();
    const hasEvictedKey = loaded.some(
      (entry) => entry.provider === "provider-0" && entry.model === "model",
    );
    expect(hasEvictedKey).toBe(true);
  });
});
