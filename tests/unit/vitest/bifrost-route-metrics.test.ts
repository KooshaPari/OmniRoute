import { describe, it, expect, beforeEach } from "vitest";
import {
  getBifrostRouteMetrics,
  getAllBifrostRouteMetrics,
  getProjectedBifrostRouteMetrics,
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

  it("projects raw stats into e2e latency, failure rate, health, stability, sample count, and timestamp", () => {
    recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5",
      status: 200,
      latencyMs: 100,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5",
      status: 500,
      latencyMs: 120,
      timestampMs: makeTimestamp(2),
      error: "temporary failure",
    });
    recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5",
      status: 200,
      latencyMs: 140,
      timestampMs: makeTimestamp(3),
    });
    recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5",
      status: 200,
      latencyMs: 160,
      timestampMs: makeTimestamp(4),
    });

    const metrics = getProjectedBifrostRouteMetrics("anthropic", "claude-3.5");
    expect(metrics).not.toBeNull();
    expect(metrics?.provider).toBe("anthropic");
    expect(metrics?.model).toBe("claude-3.5");
    expect(metrics?.sampleCount).toBe(4);
    expect(metrics?.e2eLatencyMs).toBe(160);
    expect(metrics?.failureRate).toBeCloseTo(1 - 0.75);
    expect(metrics?.health).toBeCloseTo(0.75);
    expect(metrics?.stability).toBeCloseTo(0.77, 2);
    expect(metrics?.updatedAtMs).toBe(makeTimestamp(4));
  });

  it("returns undefined health and stability below the default minimum sample threshold", () => {
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 200,
      latencyMs: 100,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 200,
      latencyMs: 110,
      timestampMs: makeTimestamp(2),
    });
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 500,
      latencyMs: 120,
      timestampMs: makeTimestamp(3),
      error: "timeout",
    });

    const metrics = getProjectedBifrostRouteMetrics("openai", "gpt-4o-mini");
    expect(metrics).not.toBeNull();
    expect(metrics?.sampleCount).toBe(3);
    expect(metrics?.health).toBeUndefined();
    expect(metrics?.stability).toBeUndefined();
    expect(metrics?.e2eLatencyMs).toBe(120);
    expect(metrics?.failureRate).toBeCloseTo(1 / 3);
  });

  it("derives stable and unstable dispersion-based stability values", () => {
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: 200,
      latencyMs: 100,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: 200,
      latencyMs: 110,
      timestampMs: makeTimestamp(2),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: 200,
      latencyMs: 115,
      timestampMs: makeTimestamp(3),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: 200,
      latencyMs: 120,
      timestampMs: makeTimestamp(4),
    });

    const stable = getProjectedBifrostRouteMetrics("gemini", "gemini-2.0-flash");
    expect(stable).not.toBeNull();
    expect(stable?.health).toBeCloseTo(1);
    expect(stable?.stability).toBeCloseTo(0.92, 2);

    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash-flaky",
      status: 200,
      latencyMs: 20,
      timestampMs: makeTimestamp(10),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash-flaky",
      status: 200,
      latencyMs: 25,
      timestampMs: makeTimestamp(11),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash-flaky",
      status: 200,
      latencyMs: 1000,
      timestampMs: makeTimestamp(12),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash-flaky",
      status: 200,
      latencyMs: 1000,
      timestampMs: makeTimestamp(13),
    });

    const unstable = getProjectedBifrostRouteMetrics("gemini", "gemini-2.0-flash-flaky");
    expect(unstable).not.toBeNull();
    expect(unstable?.health).toBeCloseTo(1);
    expect(unstable?.stability).toBeLessThan(0.05);
  });

  it("computes avgTtftMs and avgTokensPerSecond from bounded valid samples", () => {
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash-tts",
      status: 200,
      latencyMs: 120,
      ttftMs: 40,
      outputTokens: 180,
      generationDurationMs: 360,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash-tts",
      status: 200,
      latencyMs: 160,
      ttftMs: 60,
      outputTokens: 220,
      generationDurationMs: 440,
      timestampMs: makeTimestamp(2),
    });
    recordBifrostRouteOutcome({
      provider: "gemini",
      model: "gemini-2.0-flash-tts",
      status: 200,
      latencyMs: 200,
      ttftMs: 50,
      outputTokens: 150,
      generationDurationMs: 300,
      timestampMs: makeTimestamp(3),
    });

    const metrics = getProjectedBifrostRouteMetrics("gemini", "gemini-2.0-flash-tts");

    expect(metrics).not.toBeNull();
    expect(metrics?.avgTtftMs).toBeCloseTo(50);
    expect(metrics?.avgTokensPerSecond).toBeCloseTo((180 + 220 + 150) / (360 + 440 + 300) * 1000);
  });

  it("computes averages using partial telemetry and ignores missing fields", () => {
    recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5-partial",
      status: 200,
      latencyMs: 100,
      ttftMs: 30,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5-partial",
      status: 200,
      latencyMs: 120,
      outputTokens: 75,
      generationDurationMs: 250,
      timestampMs: makeTimestamp(2),
    });
    recordBifrostRouteOutcome({
      provider: "anthropic",
      model: "claude-3.5-partial",
      status: 200,
      latencyMs: 140,
      ttftMs: 50,
      outputTokens: 40,
      timestampMs: makeTimestamp(3),
    });

    const metrics = getProjectedBifrostRouteMetrics("anthropic", "claude-3.5-partial");

    expect(metrics).not.toBeNull();
    expect(metrics?.avgTtftMs).toBeCloseTo((30 + 50) / 2);
    expect(metrics?.avgTokensPerSecond).toBeCloseTo((75 / 250) * 1000);
  });

  it("returns null TTFT/TPS when valid duration token telemetry is unavailable", () => {
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-noisy",
      status: 200,
      latencyMs: 100,
      ttftMs: Number.NaN,
      outputTokens: Number.NaN,
      generationDurationMs: 250,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-noisy",
      status: 200,
      latencyMs: 110,
      ttftMs: Number.NaN,
      outputTokens: 250,
      generationDurationMs: -100,
      timestampMs: makeTimestamp(1),
    });
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-noisy",
      status: 200,
      latencyMs: 120,
      ttftMs: -1,
      outputTokens: Number.POSITIVE_INFINITY,
      generationDurationMs: 250,
      timestampMs: makeTimestamp(2),
    });
    recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-noisy",
      status: 200,
      latencyMs: 120,
      ttftMs: -10,
      outputTokens: 40,
      generationDurationMs: 0,
      timestampMs: makeTimestamp(3),
    });

    const metrics = getProjectedBifrostRouteMetrics("openai", "gpt-4o-noisy");

    expect(metrics).not.toBeNull();
    expect(metrics?.avgTtftMs).toBeNull();
    expect(metrics?.avgTokensPerSecond).toBeNull();
  });
});
