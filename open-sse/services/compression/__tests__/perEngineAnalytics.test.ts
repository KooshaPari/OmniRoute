import { describe, it, expect } from "vitest";
import {
  rollupEngine,
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

describe("rollupEngine", () => {
  it("returns zeroed + broken for empty inputs", () => {
    const r = rollupEngine("rtk", []);
    expect(r.engineName).toBe("rtk");
    expect(r.totalInvocations).toBe(0);
    expect(r.totalOriginalTokens).toBe(0);
    expect(r.totalSavedTokens).toBe(0);
    expect(r.averageCompressionRatio).toBe(0);
    expect(r.errorRate).toBe(0);
    expect(r.throughputTokensPerSecond).toBe(0);
    expect(r.status).toBe("broken");
  });

  it("aggregates basic counts and ratios", () => {
    const r = rollupEngine("rtk", [
      makeInput({ originalTokens: 1000, compressedTokens: 600 }),
      makeInput({ originalTokens: 1000, compressedTokens: 400 }),
    ]);
    expect(r.totalInvocations).toBe(2);
    expect(r.totalOriginalTokens).toBe(2000);
    expect(r.totalCompressedTokens).toBe(1000);
    expect(r.totalSavedTokens).toBe(1000);
    expect(r.averageCompressionRatio).toBeCloseTo(0.5);
  });

  it("computes error rate from summed errors", () => {
    const r = rollupEngine("rtk", [
      makeInput({ errors: 1 }),
      makeInput({ errors: 0 }),
      makeInput({ errors: 0 }),
    ]);
    expect(r.errorRate).toBeCloseTo(1 / 3);
  });

  it("computes throughput as originalTokens * 1000 / totalElapsedMs", () => {
    const r = rollupEngine("rtk", [
      makeInput({ originalTokens: 1000, elapsedMs: 100 }),
      makeInput({ originalTokens: 1000, elapsedMs: 100 }),
    ]);
    // 2000 * 1000 / 200 = 10000 tokens/s
    expect(r.throughputTokensPerSecond).toBe(10000);
  });

  it("throughput is 0 when totalElapsedMs is 0", () => {
    const r = rollupEngine("rtk", [makeInput({ elapsedMs: 0 })]);
    expect(r.throughputTokensPerSecond).toBe(0);
  });

  it("averages elapsedMs per invocation", () => {
    const r = rollupEngine("rtk", [
      makeInput({ elapsedMs: 10 }),
      makeInput({ elapsedMs: 30 }),
    ]);
    expect(r.totalElapsedMs).toBe(40);
    expect(r.averageElapsedMs).toBe(20);
  });

  it("sums costSavedUsd", () => {
    const r = rollupEngine("rtk", [
      makeInput({ costSavedUsd: 0.01 }),
      makeInput({ costSavedUsd: 0.02 }),
    ]);
    expect(r.totalCostSavedUsd).toBeCloseTo(0.03);
  });

  it("sums cachedTokens", () => {
    const r = rollupEngine("rtk", [
      makeInput({ cachedTokens: 100 }),
      makeInput({ cachedTokens: 200 }),
    ]);
    expect(r.totalCachedTokens).toBe(300);
  });

  it("classifies status as broken when errorRate > 10%", () => {
    const r = rollupEngine("rtk", [
      makeInput({ errors: 1 }),
      makeInput({ errors: 1 }),
      makeInput({ errors: 0 }),
    ]);
    // errorRate = 2/3 = 0.667 > 0.10
    expect(r.status).toBe("broken");
  });

  it("classifies status as healthy when ratio > 10% and throughput > 1000", () => {
    const r = rollupEngine("rtk", [
      makeInput({
        originalTokens: 10000,
        compressedTokens: 4000,
        elapsedMs: 100,
        errors: 0,
      }),
    ]);
    expect(r.status).toBe("healthy");
  });

  it("classifies status as degraded when ratio < 10% AND throughput < 1000", () => {
    const r = rollupEngine("rtk", [
      makeInput({
        originalTokens: 1000,
        compressedTokens: 950,
        elapsedMs: 1000,
        errors: 0,
      }),
    ]);
    // ratio = 0.05 < 0.10, throughput = 1000 < ... wait: 1000*1000/1000 = 1000, NOT < 1000
    // use longer elapsedMs
    const r2 = rollupEngine("rtk", [
      makeInput({
        originalTokens: 1000,
        compressedTokens: 950,
        elapsedMs: 10000,
        errors: 0,
      }),
    ]);
    // ratio = 0.05, throughput = 100 < 1000
    expect(r2.status).toBe("degraded");
  });
});

describe("rollupAllEngines", () => {
  it("groups by engine name", () => {
    const result = rollupAllEngines({
      rtk: [makeInput()],
      caveman: [makeInput({ engineName: "caveman", originalTokens: 2000 })],
    });
    expect(result.length).toBe(2);
    const rtk = result.find((r) => r.engineName === "rtk");
    const cav = result.find((r) => r.engineName === "caveman");
    expect(rtk).toBeDefined();
    expect(cav).toBeDefined();
    expect(cav!.totalOriginalTokens).toBe(2000);
  });

  it("handles empty input", () => {
    expect(rollupAllEngines({})).toEqual([]);
  });
});
