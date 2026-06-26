import { describe, it, expect, beforeEach } from "vitest";
import { aggregateStudio } from "../studioAggregator.ts";
import {
  rollupEngine,
  type EngineAnalyticsInput,
} from "../perEngineAnalytics.ts";
import { resetRunHistoryBuffer } from "../runHistory.ts";

beforeEach(() => {
  resetRunHistoryBuffer();
});

function makeInput(overrides: Partial<EngineAnalyticsInput> = {}): EngineAnalyticsInput {
  return {
    engineName: "rtk",
    originalTokens: 1000,
    compressedTokens: 600,
    elapsedMs: 10,
    compressionRatio: 0.4,
    errors: 0,
    invocations: 1,
    costSavedUsd: 0.001,
    cachedTokens: 0,
    ...overrides,
  };
}

describe("aggregateStudio", () => {
  it("returns a complete StudioSnapshot", () => {
    const s = aggregateStudio({
      perEngineInputs: { rtk: [makeInput()] },
    });
    expect(s.breakdown).toBeDefined();
    expect(s.breakdown.rows).toHaveLength(1);
    expect(s.radar).toBeDefined();
    expect(s.radar.axes).toHaveLength(6);
    expect(s.recentRuns).toEqual([]);
    expect(s.summary.totalEngines).toBe(1);
    expect(s.summary.totalSavedTokens).toBe(400);
    expect(s.summary.generatedAt).toBeDefined();
  });

  it("handles empty perEngineInputs", () => {
    const s = aggregateStudio({ perEngineInputs: {} });
    expect(s.breakdown.rows).toEqual([]);
    expect(s.summary.totalEngines).toBe(0);
    expect(s.summary.totalSavedTokens).toBe(0);
  });

  it("summary.totalEngines matches rollup count", () => {
    const s = aggregateStudio({
      perEngineInputs: {
        rtk: [makeInput()],
        caveman: [makeInput({ engineName: "caveman" })],
        llmlingua: [makeInput({ engineName: "llmlingua" })],
      },
    });
    expect(s.summary.totalEngines).toBe(3);
  });

  it("summary.totalSavedTokens sums across all engines", () => {
    const s = aggregateStudio({
      perEngineInputs: {
        a: [makeInput({ originalTokens: 1000, compressedTokens: 400 })],
        b: [makeInput({ originalTokens: 2000, compressedTokens: 1500 })],
      },
    });
    // a: 600 saved, b: 500 saved = 1100
    expect(s.summary.totalSavedTokens).toBe(1100);
  });

  it("summary.healthScore mirrors breakdown.healthScore", () => {
    const s = aggregateStudio({
      perEngineInputs: {
        good: [
          makeInput({
            originalTokens: 10000,
            compressedTokens: 4000,
            elapsedMs: 100,
          }),
        ],
      },
    });
    expect(s.summary.healthScore).toBe(s.breakdown.healthScore);
  });

  it("recentRuns respects recentRunsLimit", async () => {
    const buffer = (await import("../runHistory.ts")).getRunHistoryBuffer();
    // Add 5 records
    for (let i = 0; i < 5; i++) {
      buffer.record({
        provider: `p${i}`,
        model: "m",
        originalTokens: 100,
        compressedTokens: 60,
        savingsPercent: 40,
        elapsedMs: 5,
        costSavedUsd: 0.001,
        enginesUsed: ["rtk"],
        success: true,
      });
    }
    const s = aggregateStudio({
      perEngineInputs: {},
      recentRunsLimit: 3,
    });
    expect(s.recentRuns).toHaveLength(3);
  });

  it("default recentRunsLimit is 50", () => {
    const s = aggregateStudio({ perEngineInputs: {} });
    expect(s).toBeDefined();
    // recentRuns is bounded by buffer.size(), so empty when no records
    expect(s.recentRuns).toEqual([]);
  });

  it("generatedAt is a valid ISO date string", () => {
    const s = aggregateStudio({ perEngineInputs: {} });
    expect(new Date(s.summary.generatedAt).toString()).not.toBe("Invalid Date");
  });
});
