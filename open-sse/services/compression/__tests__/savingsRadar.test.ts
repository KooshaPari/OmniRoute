import { describe, it, expect } from "vitest";
import { computeSavingsRadar } from "../savingsRadar.ts";
import {
  rollupAllEngines,
  type EngineAnalyticsInput,
} from "../perEngineAnalytics.ts";

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

describe("computeSavingsRadar", () => {
  it("returns 6 axes in the documented order", () => {
    const rollups = rollupAllEngines({ rtk: [makeInput()] });
    const r = computeSavingsRadar(rollups);
    expect(r.axes.map((a) => a.axis)).toEqual([
      "token-savings",
      "cost-savings",
      "latency-saved",
      "cache-hits",
      "error-rate",
      "coverage",
    ]);
  });

  it("clamps axis values to 0..100", () => {
    const rollups = rollupAllEngines({
      rtk: [
        makeInput({
          originalTokens: 100,
          compressedTokens: 0, // 100% savings (above 100% clamp target)
          elapsedMs: 1,
        }),
      ],
    });
    const r = computeSavingsRadar(rollups);
    for (const axis of r.axes) {
      expect(axis.value).toBeGreaterThanOrEqual(0);
      expect(axis.value).toBeLessThanOrEqual(100);
    }
  });

  it("computes token-savings axis from total compression ratio", () => {
    const rollups = rollupAllEngines({
      rtk: [
        makeInput({
          originalTokens: 1000,
          compressedTokens: 700,
        }),
      ],
    });
    const r = computeSavingsRadar(rollups);
    const token = r.axes.find((a) => a.axis === "token-savings")!;
    // 30% savings = value 30
    expect(token.value).toBe(30);
    expect(token.raw).toBeCloseTo(0.3);
  });

  it("coverage is 100 when at least one engine is present", () => {
    const rollups = rollupAllEngines({ rtk: [makeInput()] });
    const r = computeSavingsRadar(rollups);
    const coverage = r.axes.find((a) => a.axis === "coverage")!;
    expect(coverage.raw).toBe(1.0);
    // value is capped at 100 (1.0 / 0.95 ~= 1.05 would be 105, capped to 100)
    expect(coverage.value).toBeLessThanOrEqual(100);
    expect(coverage.value).toBeGreaterThan(100 * 0.99);
  });

  it("coverage is 0 with no engines", () => {
    const r = computeSavingsRadar([]);
    const coverage = r.axes.find((a) => a.axis === "coverage")!;
    expect(coverage.raw).toBe(0.0);
    expect(coverage.value).toBe(0);
  });

  it("error-rate axis inverts (lower errorRate -> higher value)", () => {
    const r1 = computeSavingsRadar(
      rollupAllEngines({
        a: [makeInput({ errors: 0 })],
      }),
    );
    const r2 = computeSavingsRadar(
      rollupAllEngines({
        a: [makeInput({ errors: 1 })],
      }),
    );
    const e1 = r1.axes.find((a) => a.axis === "error-rate")!.value;
    const e2 = r2.axes.find((a) => a.axis === "error-rate")!.value;
    expect(e1).toBeGreaterThan(e2);
  });

  it("overallScore is the mean of axis values", () => {
    const rollups = rollupAllEngines({ rtk: [makeInput()] });
    const r = computeSavingsRadar(rollups);
    const expected = Math.round(
      r.axes.reduce((s, a) => s + a.value, 0) / r.axes.length,
    );
    expect(r.overallScore).toBe(expected);
  });

  it("generatedAt is a valid ISO date string", () => {
    const r = computeSavingsRadar([]);
    expect(new Date(r.generatedAt).toString()).not.toBe("Invalid Date");
  });
});
