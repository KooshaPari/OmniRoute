import { describe, it, expect, beforeEach } from "vitest";
import {
  RunHistoryBuffer,
  getRunHistoryBuffer,
  resetRunHistoryBuffer,
  type CompressedRunRecord,
} from "../runHistory.ts";

beforeEach(() => {
  resetRunHistoryBuffer();
});

describe("RunHistoryBuffer", () => {
  it("starts empty", () => {
    const b = new RunHistoryBuffer(10);
    expect(b.size()).toBe(0);
    expect(b.list()).toEqual([]);
  });

  it("throws on non-positive capacity", () => {
    expect(() => new RunHistoryBuffer(0)).toThrow();
    expect(() => new RunHistoryBuffer(-1)).toThrow();
  });

  it("records with auto-generated id and timestamp", () => {
    const b = new RunHistoryBuffer(10);
    const rec = b.record({
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      originalTokens: 1000,
      compressedTokens: 600,
      savingsPercent: 40,
      elapsedMs: 50,
      costSavedUsd: 0.001,
      enginesUsed: ["rtk"],
      success: true,
    });
    expect(rec.id).toMatch(/^run-\d+-\d+$/);
    expect(rec.timestamp).toBeDefined();
    expect(rec.provider).toBe("anthropic");
  });

  it("respects explicit timestamp when provided", () => {
    const b = new RunHistoryBuffer(10);
    const rec = b.record({
      provider: "anthropic",
      model: "x",
      originalTokens: 100,
      compressedTokens: 50,
      savingsPercent: 50,
      elapsedMs: 1,
      costSavedUsd: 0,
      enginesUsed: [],
      success: true,
      timestamp: "2025-06-22T00:00:00.000Z",
    });
    expect(rec.timestamp).toBe("2025-06-22T00:00:00.000Z");
  });

  it("list returns most-recent first (LIFO)", () => {
    const b = new RunHistoryBuffer(10);
    b.record({ provider: "a", model: "m", originalTokens: 1, compressedTokens: 1, savingsPercent: 0, elapsedMs: 1, costSavedUsd: 0, enginesUsed: [], success: true });
    b.record({ provider: "b", model: "m", originalTokens: 1, compressedTokens: 1, savingsPercent: 0, elapsedMs: 1, costSavedUsd: 0, enginesUsed: [], success: true });
    const list = b.list();
    expect(list[0].provider).toBe("b");
    expect(list[1].provider).toBe("a");
  });

  it("list respects limit", () => {
    const b = new RunHistoryBuffer(10);
    for (let i = 0; i < 5; i++) {
      b.record({ provider: `p${i}`, model: "m", originalTokens: 1, compressedTokens: 1, savingsPercent: 0, elapsedMs: 1, costSavedUsd: 0, enginesUsed: [], success: true });
    }
    expect(b.list(2)).toHaveLength(2);
    expect(b.list(20)).toHaveLength(5);
  });

  it("evicts oldest records when capacity is reached", () => {
    const b = new RunHistoryBuffer(3);
    for (let i = 0; i < 5; i++) {
      b.record({ provider: `p${i}`, model: "m", originalTokens: 1, compressedTokens: 1, savingsPercent: 0, elapsedMs: 1, costSavedUsd: 0, enginesUsed: [], success: true });
    }
    expect(b.size()).toBe(3);
    const all = b.list(100);
    expect(all.map((r) => r.provider)).toEqual(["p4", "p3", "p2"]);
  });

  it("get finds a record by id", () => {
    const b = new RunHistoryBuffer(10);
    const rec = b.record({ provider: "a", model: "m", originalTokens: 1, compressedTokens: 1, savingsPercent: 0, elapsedMs: 1, costSavedUsd: 0, enginesUsed: [], success: true });
    expect(b.get(rec.id)).toEqual(rec);
    expect(b.get("non-existent")).toBeNull();
  });

  it("clear empties the buffer", () => {
    const b = new RunHistoryBuffer(10);
    b.record({ provider: "a", model: "m", originalTokens: 1, compressedTokens: 1, savingsPercent: 0, elapsedMs: 1, costSavedUsd: 0, enginesUsed: [], success: true });
    expect(b.size()).toBe(1);
    b.clear();
    expect(b.size()).toBe(0);
  });

  it("capacity$ returns the configured capacity", () => {
    const b = new RunHistoryBuffer(7);
    expect(b.capacity$()).toBe(7);
  });
});

describe("singleton", () => {
  it("getRunHistoryBuffer returns the same instance", () => {
    const a = getRunHistoryBuffer();
    const b = getRunHistoryBuffer();
    expect(a).toBe(b);
  });

  it("resetRunHistoryBuffer clears the singleton", () => {
    const a = getRunHistoryBuffer();
    a.record({ provider: "x", model: "m", originalTokens: 1, compressedTokens: 1, savingsPercent: 0, elapsedMs: 1, costSavedUsd: 0, enginesUsed: [], success: true });
    expect(getRunHistoryBuffer().size()).toBe(1);
    resetRunHistoryBuffer();
    expect(getRunHistoryBuffer().size()).toBe(0);
  });
});
