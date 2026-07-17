import { describe, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/db/bifrostRouteMetrics.ts", async () => {
  const actual = await vi.importActual<typeof import("../../../src/lib/db/bifrostRouteMetrics.ts")>(
    "@/lib/db/bifrostRouteMetrics.ts"
  );

  return {
    ...actual,
    loadBifrostRouteMetricSamples: vi.fn(() => {
      throw new Error("db unavailable");
    }),
  };
});

import * as metrics from "../../../open-sse/observability/bifrostRouteMetrics.ts";

const baseTime = 1_700_000_000_000;

describe("bifrostRouteMetrics hydration", () => {
  beforeEach(() => {
    metrics.resetBifrostRouteMetricsForTest();
    metrics.resetBifrostRouteMetricsHydrationStateForTest();
  });

  it("marks hydration as attempted when DB load fails and keeps in-memory fallback", () => {
    metrics.recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 200,
      latencyMs: 120,
      timestampMs: baseTime + 1,
    });

    metrics.initializeBifrostRouteMetricsFromStorage();

    expect(metrics.getBifrostRouteMetricsHydrationStateForTest()).toBe("attempted");
    expect(metrics.getBifrostRouteMetricsHydrationAttemptsForTest()).toBe(1);
    metrics.recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 200,
      latencyMs: 130,
      timestampMs: baseTime + 2,
    });

    expect(metrics.getBifrostRouteMetrics("openai", "gpt-4o-mini")).not.toBeNull();
    expect(metrics.getBifrostRouteMetrics("openai", "gpt-4o-mini")?.sampleCount).toBe(1);
  });

  it("supports explicit forced retry attempts after a failed hydration", () => {
    metrics.recordBifrostRouteOutcome({
      provider: "openai",
      model: "gpt-4o-mini",
      status: 200,
      latencyMs: 120,
      timestampMs: baseTime + 1,
    });

    metrics.initializeBifrostRouteMetricsFromStorage();
    metrics.initializeBifrostRouteMetricsFromStorage({ force: true });

    expect(metrics.getBifrostRouteMetricsHydrationStateForTest()).toBe("attempted");
    expect(metrics.getBifrostRouteMetricsHydrationAttemptsForTest()).toBe(1);
  });
});
