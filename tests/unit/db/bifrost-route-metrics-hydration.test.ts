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
const metricsPersistence = await import("../../../src/lib/db/bifrostRouteMetrics.ts");

const MAX_SAMPLES_PER_KEY = metricsPersistence.BIFROST_ROUTE_METRICS_MAX_SAMPLES_PER_KEY;

function persistSamplesForModel(
  provider: string,
  model: string,
  entries: Array<{ status?: number | null; latencyMs: number; timestampMs: number }>
): void {
  metricsPersistence.persistBifrostRouteMetricSamples(
    [
      {
        provider,
        model,
        samples: entries.map((entry) => ({
          provider,
          model,
          timestampMs: entry.timestampMs,
          status:
            typeof entry.status === "number" ? entry.status : null,
          latencyMs: entry.latencyMs,
          ok:
            entry.status === undefined || entry.status === null
              ? true
              : entry.status >= 200 && entry.status < 300,
          error: null,
          ttftMs: null,
          outputTokens: null,
          generationDurationMs: null,
        })),
      },
    ],
    {
      maxSamplesPerKey: MAX_SAMPLES_PER_KEY,
    }
  );
}

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

test("explicit startup-style hydration restores persisted samples and is idempotent", () => {
  const base = makeTimestamp(100);
  const db = core.getDbInstance();
  db.prepare("DELETE FROM bifrost_route_metrics").run();

  persistSamplesForModel("openai", "gpt-4o-mini", [
    { status: 200, latencyMs: 100, timestampMs: base },
    { status: 500, latencyMs: 120, timestampMs: base + 1 },
    { status: 200, latencyMs: 80, timestampMs: base + 2 },
  ]);

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

test("hydrated partial ring evicts oldest retained sample after first post-hydration overflow", async () => {
  const db = core.getDbInstance();
  db.prepare("DELETE FROM bifrost_route_metrics").run();

  const provider = "openai";
  const model = "gpt-4o-partial-overflow";

  persistSamplesForModel(
    provider,
    model,
    [
      {
        status: 200,
        latencyMs: 100,
        timestampMs: makeTimestamp(10),
      },
      {
        status: 200,
        latencyMs: 200,
        timestampMs: makeTimestamp(20),
      },
      {
        status: 200,
        latencyMs: 300,
        timestampMs: makeTimestamp(30),
      },
    ]
  );

  metrics.resetBifrostRouteMetricsForTest();
  metrics.resetBifrostRouteMetricsHydrationStateForTest();

  metrics.initializeBifrostRouteMetricsFromStorage();
  assert.equal(metrics.getBifrostRouteMetrics("openai", "gpt-4o-partial-overflow")?.sampleCount, 3);

  for (let idx = 0; idx < MAX_SAMPLES_PER_KEY - 3 + 1; idx += 1) {
    metrics.recordBifrostRouteOutcome({
      provider,
      model,
      status: 200,
      latencyMs: 1_000 + idx,
      timestampMs: makeTimestamp(1_000 + idx),
    });
  }

  const partialState = metrics.getBifrostRouteMetrics(provider, model);
  assert.notEqual(partialState, null);
  assert.equal(partialState?.sampleCount, MAX_SAMPLES_PER_KEY);
  assert.equal(partialState?.avgLatencyMs, 1006);
});

test("hydrated full ring evicts oldest sample first on next post-hydration write", async () => {
  const db = core.getDbInstance();
  db.prepare("DELETE FROM bifrost_route_metrics").run();

  const provider = "openai";
  const model = "gpt-4o-full-overflow";

  persistSamplesForModel(
    provider,
    model,
    Array.from({ length: MAX_SAMPLES_PER_KEY }, (_, idx) => ({
      status: 200,
      latencyMs: idx + 1,
      timestampMs: makeTimestamp(2_000 + idx),
    }))
  );

  metrics.resetBifrostRouteMetricsForTest();
  metrics.resetBifrostRouteMetricsHydrationStateForTest();

  metrics.initializeBifrostRouteMetricsFromStorage();
  assert.equal(metrics.getBifrostRouteMetrics(provider, model)?.sampleCount, MAX_SAMPLES_PER_KEY);

  metrics.recordBifrostRouteOutcome({
    provider,
    model,
    status: 200,
    latencyMs: 10_000,
    timestampMs: makeTimestamp(3_000),
  });

  const fullState = metrics.getBifrostRouteMetrics(provider, model);
  assert.notEqual(fullState, null);
  assert.equal(fullState?.sampleCount, MAX_SAMPLES_PER_KEY);
  assert.equal(fullState?.avgLatencyMs, 189);
});
