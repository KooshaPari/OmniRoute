import { describe, it, expect } from "vitest";
import { projectBreakdown } from "../breakdownProjector.ts";
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

describe("projectBreakdown", () => {
  it("projects rollups into UI rows with correct fields", () => {
    const rollups = rollupAllEngines({
      rtk: [makeInput({ originalTokens: 1000, compressedTokens: 400 })],
    });
    const m = projectBreakdown(rollups);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].engineName).toBe("rtk");
    expect(m.rows[0].savedTokens).toBe(600);
    expect(m.rows[0].savingsPercent).toBe(60);
  });

  it("assigns engineIndex in source order", () => {
    const rollups = rollupAllEngines({
      a: [makeInput()],
      b: [makeInput()],
      c: [makeInput()],
    });
    const m = projectBreakdown(rollups);
    expect(m.rows.map((r) => r.engineIndex)).toEqual([0, 1, 2]);
  });

  it("derives health from status (broken->critical, degraded->warning)", () => {
    const rollups = rollupAllEngines({
      good: [
        makeInput({
          originalTokens: 10000,
          compressedTokens: 4000,
          elapsedMs: 100,
          errors: 0,
        }),
      ],
      bad: [
        makeInput({
          engineName: "bad",
          originalTokens: 100,
          compressedTokens: 99,
          elapsedMs: 1000,
          errors: 100,
        }),
      ],
    });
    const m = projectBreakdown(rollups);
    const good = m.rows.find((r) => r.engineName === "good");
    const bad = m.rows.find((r) => r.engineName === "bad");
    expect(good!.health).toBe("good");
    expect(bad!.health).toBe("critical");
  });

  it("computes totals across all engines", () => {
    const rollups = rollupAllEngines({
      a: [makeInput({ originalTokens: 1000, compressedTokens: 600, costSavedUsd: 0.01 })],
      b: [makeInput({ originalTokens: 2000, compressedTokens: 800, costSavedUsd: 0.02 })],
    });
    const m = projectBreakdown(rollups);
    expect(m.totals.originalTokens).toBe(3000);
    expect(m.totals.compressedTokens).toBe(1400);
    expect(m.totals.savedTokens).toBe(1600);
    expect(m.totals.costSavedUsd).toBeCloseTo(0.03);
  });

  it("computes healthScore as 100 when all rows are good", () => {
    const rollups = rollupAllEngines({
      a: [
        makeInput({
          originalTokens: 10000,
          compressedTokens: 4000,
          elapsedMs: 100,
        }),
      ],
      b: [
        makeInput({
          engineName: "b",
          originalTokens: 10000,
          compressedTokens: 4000,
          elapsedMs: 100,
        }),
      ],
    });
    const m = projectBreakdown(rollups);
    expect(m.healthScore).toBe(100);
  });

  it("computes healthScore as 0 when all rows are critical", () => {
    const rollups = rollupAllEngines({
      bad: [
        makeInput({
          originalTokens: 100,
          compressedTokens: 99,
          errors: 100,
          elapsedMs: 1000,
        }),
      ],
    });
    const m = projectBreakdown(rollups);
    expect(m.healthScore).toBe(0);
  });

  it("handles empty rollups (healthScore = 100, totals = 0)", () => {
    const m = projectBreakdown([]);
    expect(m.rows).toEqual([]);
    expect(m.healthScore).toBe(100);
    expect(m.totals.originalTokens).toBe(0);
  });

  it("generatedAt is a valid ISO date string", () => {
    const rollups = rollupAllEngines({ rtk: [makeInput()] });
    const m = projectBreakdown(rollups);
    expect(new Date(m.generatedAt).toString()).not.toBe("Invalid Date");
  });
});
