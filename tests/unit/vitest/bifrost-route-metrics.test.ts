import { describe, it, expect, beforeEach } from "vitest";
import {
  getBifrostRouteMetrics,
  getAllBifrostRouteMetrics,
  recordBifrostRouteOutcome,
  resetBifrostRouteMetricsForTest,
} from "../../../open-sse/observability/bifrostRouteMetrics.ts";

function makeTimestamp(offsetMs: number): number {
  return 1_700_000_000_000 + offsetMs;
}

describe("bifrostRouteMetrics", () => {
  beforeEach(() => {
    resetBifrostRouteMetricsForTest();
  });

  it("aggregates provider-model outcomes and derived latency stats", () => {
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o",
      status: 200,
      latencyMs: 120,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o",
      status: 500,
      latencyMs: 300,
      error: "provider failed",
      timestampMs: makeTimestamp(2),
    });
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o",
      status: 201,
      latencyMs: 180,
      timestampMs: makeTimestamp(3),
    });

    const stats = getBifrostRouteMetrics("openai", "gpt-4o");
    expect(stats).not.toBeNull();
    expect(stats?.sampleCount).toBe(3);
    expect(stats?.successCount).toBe(2);
    expect(stats?.failureCount).toBe(1);
    expect(stats?.successRate).toBe(2 / 3);
    expect(stats?.avgLatencyMs).toBe(Math.round((120 + 300 + 180) / 3));
    expect(stats?.p95LatencyMs).toBe(300);
    expect(stats?.lastStatus).toBe(201);
    expect(stats?.lastError).toBeNull();
  });

  it("keeps only the latest 64 samples per provider-model key", () => {
    for (let idx = 1; idx <= 70; idx += 1) {
      recordBifrostRouteOutcome({
        provider: "openai",
        model: "gpt-4o",
        status: 200,
        latencyMs: idx,
        timestampMs: makeTimestamp(idx),
      });
    }

    const stats = getBifrostRouteMetrics("openai", "gpt-4o");
    expect(stats).not.toBeNull();
    expect(stats?.sampleCount).toBe(64);
    // Last 64 latency samples are 7..70 (sum 2464).
    expect(stats?.avgLatencyMs).toBe(Math.round(2464 / 64));
    expect(stats?.p95LatencyMs).toBe(67);
    expect(stats?.successCount).toBe(64);
  });

  it("evicts oldest provider-model keys via deterministic LRU when key cap is exceeded", () => {
    for (let idx = 0; idx < 512; idx += 1) {
      recordBifrostRouteOutcome({
        provider: `provider-${idx}`,
        model: "model",
        status: 200,
        latencyMs: 42,
        timestampMs: makeTimestamp(idx),
      });
    }

    expect(getAllBifrostRouteMetrics()).toHaveLength(512);
    expect(getBifrostRouteMetrics("provider-0", "model")).not.toBeNull();
    expect(getBifrostRouteMetrics("provider-511", "model")).not.toBeNull();

    // Touch the oldest key to make it most-recently used, then exceed capacity by one.
    recordBifrostRouteOutcome({
      provider: "provider-0",
      model: "model",
      status: 200,
      latencyMs: 43,
      timestampMs: makeTimestamp(513),
    });
    recordBifrostRouteOutcome({
      provider: "provider-512",
      model: "model",
      status: 200,
      latencyMs: 44,
      timestampMs: makeTimestamp(514),
    });

    expect(getAllBifrostRouteMetrics()).toHaveLength(512);
    expect(getBifrostRouteMetrics("provider-0", "model")).not.toBeNull();
    expect(getBifrostRouteMetrics("provider-1", "model")).toBeNull();
    expect(getBifrostRouteMetrics("provider-511", "model")).not.toBeNull();
    expect(getBifrostRouteMetrics("provider-512", "model")).not.toBeNull();
  });
});
