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

  it("persists and hydrates connection-aware keys independently", async () => {
    const now = makeTimestamp();
    metrics.recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      connectionId: "connection-a",
      status: 200,
      latencyMs: 80,
      timestampMs: now - 1_000,
    });
    metrics.recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      connectionId: "connection-b",
      status: 500,
      latencyMs: 160,
      timestampMs: now,
    });
    await metrics.flushBifrostRouteMetricsPersistenceForTest();
    const persisted = db.loadBifrostRouteMetricSamples();
    assert.equal(persisted.length, 2);
    assert.deepEqual(persisted.map((entry) => entry.connectionId).sort(), [
      "connection-a",
      "connection-b",
    ]);
    metrics.resetBifrostRouteMetricsForTest();
    metrics.hydrateBifrostRouteMetricsFromStorageForTest();
    assert.equal(
      metrics.getBifrostRouteMetrics("openai", "gpt-4o-mini", "connection-a")?.successCount,
      1
    );
    assert.equal(
      metrics.getBifrostRouteMetrics("openai", "gpt-4o-mini", "connection-b")?.failureCount,
      1
    );
  });

  it("keeps stale rows ineligible under freshness rules and allows fresh rows", async () => {
    const now = makeTimestamp();

    for (let i = 0; i < 4; i++) {
      metrics.recordBifrostRouteOutcome({
        provider: "openai",
        model: "stale-only",
        status: 200,
        latencyMs: 100 + i * 5,
        timestampMs: now - 16 * 60 * 1000 - i * 1000,
      });
      metrics.recordBifrostRouteOutcome({
        provider: "openai",
        model: "fresh",
        status: 200,
        latencyMs: 120 + i * 5,
        timestampMs: now - 5 * 60 * 1000 - i * 1000,
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

  it("merges independent snapshots for the same provider-model key without dropping prior samples", async () => {
    const now = makeTimestamp();

    metrics.recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 200,
      latencyMs: 80,
      ttftMs: null,
      outputTokens: null,
      generationDurationMs: null,
      timestampMs: now - 2_000,
    });
    await metrics.flushBifrostRouteMetricsPersistenceForTest();

    metrics.resetBifrostRouteMetricsForTest();
    metrics.recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 500,
      latencyMs: 120,
      error: "transient transport failure",
      ttftMs: null,
      outputTokens: null,
      generationDurationMs: null,
      timestampMs: now - 1_000,
    });
    await metrics.flushBifrostRouteMetricsPersistenceForTest();

    const persisted = db.loadBifrostRouteMetricSamples();
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].samples.length, 2);
    assert.equal(persisted[0].samples[0].timestampMs, now - 2_000);
    assert.equal(persisted[0].samples[1].timestampMs, now - 1_000);
  });

  it("deduplicates repeated persistence of the same sample set by stable sample identity", async () => {
    const base = makeTimestamp(10_000);

    metrics.recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5",
      status: 200,
      latencyMs: 95,
      ttftMs: 30,
      outputTokens: 100,
      generationDurationMs: 500,
      timestampMs: base,
    });
    await metrics.flushBifrostRouteMetricsPersistenceForTest();

    metrics.resetBifrostRouteMetricsForTest();
    metrics.recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5",
      status: 200,
      latencyMs: 95,
      ttftMs: 30,
      outputTokens: 100,
      generationDurationMs: 500,
      timestampMs: base,
    });
    await metrics.flushBifrostRouteMetricsPersistenceForTest();

    const persisted = db.loadBifrostRouteMetricSamples();
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].samples.length, 1);
    assert.equal(persisted[0].samples[0].status, 200);
    assert.equal(persisted[0].samples[0].latencyMs, 95);
  });

  it("flushes pending shutdown metrics via lifecycle hook without waiting for debounce", async () => {
    const now = makeTimestamp();

    metrics.recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3-7-20250226",
      status: 200,
      latencyMs: 120,
      ttftMs: 25,
      outputTokens: 180,
      generationDurationMs: 500,
      timestampMs: now,
    });

    await metrics.flushBifrostRouteMetricsPersistenceForShutdown();

    await metrics.flushBifrostRouteMetricsPersistenceForShutdown();

    const persisted = db.loadBifrostRouteMetricSamples();
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].samples.length, 1);
    assert.equal(persisted[0].provider, "anthropic");
    assert.equal(persisted[0].model, "claude-3-7-20250226");
    assert.equal(persisted[0].samples[0].latencyMs, 120);

    await metrics.flushBifrostRouteMetricsPersistenceForShutdown();
    const persistedAfterSecondFlush = db.loadBifrostRouteMetricSamples();
    assert.equal(persistedAfterSecondFlush.length, 1);
    assert.equal(persistedAfterSecondFlush[0].samples.length, 1);
  });
});
