import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-bifrost-metrics-test-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../../src/lib/db/core.ts");
const db = await import("../../../src/lib/db/bifrostRouteMetrics.ts");
const metrics = await import("../../../open-sse/observability/bifrostRouteMetrics.ts");

function resetStorage(): void {
  core.resetDbInstance();
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  } catch {
    /* eslint-disable-line no-empty */
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function makeTimestamp(offsetMs = 0): number {
  return Date.now() + offsetMs;
}

describe("bifrostRouteMetrics DB persistence", () => {
  beforeEach(() => {
    resetStorage();
    metrics.resetBifrostRouteMetricsForTest();
  });

  it("persists samples and restores the same metrics after cache reset", async () => {
    const base = makeTimestamp();

    for (let i = 0; i < 4; i++) {
      metrics.recordBifrostRouteOutcome({
        provider: "openai",
        model: "gpt-4o-mini",
        status: 200,
        latencyMs: 100 + i * 5,
        ttftMs: 20 + i,
        outputTokens: 100 + i,
        generationDurationMs: 500 + i * 10,
        timestampMs: base - i * 1000,
      });
    }

    await metrics.flushBifrostRouteMetricsPersistenceForTest();

    const persisted = db.loadBifrostRouteMetricSamples();
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].samples.length, 4);

    metrics.resetBifrostRouteMetricsForTest();
    metrics.hydrateBifrostRouteMetricsFromStorageForTest();

    const inMemory = metrics.getBifrostRouteMetrics("openai", "gpt-4o-mini");
    assert.equal(inMemory?.sampleCount, 4);
    assert.equal(inMemory?.avgLatencyMs, 108);

    const projected = metrics.getProjectedBifrostRouteMetrics("openai", "gpt-4o-mini", {
      nowMs: base + 100,
    });
    assert.notEqual(projected, null);
    assert.equal(projected?.sampleCount, 4);
    assert.equal(projected?.health, 1);
    assert.ok(projected?.avgTtftMs !== null);
  });

  it("keeps stale rows ineligible under freshness rules and allows fresh rows", async () => {
    const now = makeTimestamp();

    for (let i = 0; i < 4; i++) {
      metrics.recordBifrostRouteOutcome({
        provider: "openai",
        model: "stale-only",
        status: 200,
        latencyMs: 100 + i * 5,
        timestampMs: now - (16 * 60 * 1000) - (i * 1000),
      });
      metrics.recordBifrostRouteOutcome({
        provider: "openai",
        model: "fresh",
        status: 200,
        latencyMs: 120 + i * 5,
        timestampMs: now - (5 * 60 * 1000) - (i * 1000),
      });
    }

    await metrics.flushBifrostRouteMetricsPersistenceForTest();

    metrics.resetBifrostRouteMetricsForTest();
    metrics.hydrateBifrostRouteMetricsFromStorageForTest();

    const staleProjected = metrics.getProjectedBifrostRouteMetrics("openai", "stale-only", {
      nowMs: now,
    });
    const freshProjected = metrics.getProjectedBifrostRouteMetrics("openai", "fresh", {
      nowMs: now,
    });

    assert.equal(staleProjected, null);
    assert.equal(freshProjected?.sampleCount, 4);
    assert.equal(freshProjected?.health, 1);
  });
});
