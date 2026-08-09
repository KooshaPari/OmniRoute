/**
 * chatForkState.diff.test.ts — unit tests for PR-λ diff + CLI formatter.
 *
 * Verifies:
 *   - diffForkChatStates(): null/undefined guards, versionChanged,
 *     cacheChanged, cacheFieldsChanged, generatedAtMsDelta
 *   - formatForkChatStateForCli(): contains version, all key fields,
 *     custom snapshot argument works
 */
import { describe, expect, it } from "vitest";
import {
  diffForkChatStates,
  formatForkChatStateForCli,
  getForkChatState,
  type ForkChatStateSnapshot,
} from "../chatForkState";

describe("chatForkState.diffForkChatStates", () => {
  function makeSnapshot(overrides: Partial<ForkChatStateSnapshot> = {}): ForkChatStateSnapshot {
    return {
      version: "1.0.0",
      generatedAtMs: 1000,
      combosCache: {
        hasCachedPromise: false,
        cachedAtMs: 0,
        cachedVersion: -1,
        ttlMs: 10_000,
      },
      breakerPredicates: {
        statusCodes: [408, 500, 502, 503, 504],
        size: 5,
        sampleTrue: { status: 503, tripsBreaker: true },
        sampleFalse: { status: 200, tripsBreaker: false },
      },
      cooldownHelpers: {
        sampleFormatSeconds: { inputMs: 7500, outputSec: 8 },
        sampleDescribeWait: {
          input: { shouldRetry: true, waitMs: 7500 },
          output: "8s",
        },
        sampleNoRetry: { output: "no-retry" },
      },
      ...overrides,
    };
  }

  it("returns cacheChanged=false for identical snapshots", () => {
    const a = makeSnapshot();
    const b = makeSnapshot();
    const diff = diffForkChatStates(a, b);
    expect(diff.cacheChanged).toBe(false);
    expect(diff.cacheFieldsChanged).toEqual([]);
    expect(diff.versionChanged).toBe(false);
  });

  it("returns versionChanged=true when versions differ", () => {
    const a = makeSnapshot({ version: "1.0.0" });
    const b = makeSnapshot({ version: "1.1.0" });
    const diff = diffForkChatStates(a, b);
    expect(diff.versionChanged).toBe(true);
  });

  it("returns cacheChanged=true when hasCachedPromise differs", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({
      combosCache: {
        ...a.combosCache,
        hasCachedPromise: true,
        cachedAtMs: 999,
        cachedVersion: 7,
      },
    });
    const diff = diffForkChatStates(a, b);
    expect(diff.cacheChanged).toBe(true);
    expect(diff.cacheFieldsChanged).toContain("hasCachedPromise");
    expect(diff.cacheFieldsChanged).toContain("cachedAtMs");
    expect(diff.cacheFieldsChanged).toContain("cachedVersion");
  });

  it("does NOT include ttlMs in cacheFieldsChanged when ttlMs is unchanged", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({
      combosCache: { ...a.combosCache, cachedAtMs: 999 },
    });
    const diff = diffForkChatStates(a, b);
    expect(diff.cacheFieldsChanged).toContain("cachedAtMs");
    expect(diff.cacheFieldsChanged).not.toContain("ttlMs");
    expect(diff.cacheFieldsChanged).not.toContain("hasCachedPromise");
    expect(diff.cacheFieldsChanged).not.toContain("cachedVersion");
  });

  it("computes generatedAtMsDelta as positive when after is newer", () => {
    const a = makeSnapshot({ generatedAtMs: 1000 });
    const b = makeSnapshot({ generatedAtMs: 1500 });
    const diff = diffForkChatStates(a, b);
    expect(diff.generatedAtMsDelta).toBe(500);
  });

  it("computes generatedAtMsDelta as negative when before is newer", () => {
    const a = makeSnapshot({ generatedAtMs: 2000 });
    const b = makeSnapshot({ generatedAtMs: 1000 });
    const diff = diffForkChatStates(a, b);
    expect(diff.generatedAtMsDelta).toBe(-1000);
  });

  it("returns cacheChanged=false when before is null", () => {
    const diff = diffForkChatStates(null, makeSnapshot());
    expect(diff.cacheChanged).toBe(false);
    expect(diff.versionChanged).toBe(false);
    expect(diff.cacheFieldsChanged).toEqual([]);
    expect(diff.generatedAtMsDelta).toBe(0);
  });

  it("returns cacheChanged=false when after is null", () => {
    const diff = diffForkChatStates(makeSnapshot(), null);
    expect(diff.cacheChanged).toBe(false);
    expect(diff.versionChanged).toBe(false);
    expect(diff.cacheFieldsChanged).toEqual([]);
    expect(diff.generatedAtMsDelta).toBe(0);
  });

  it("returns cacheChanged=false when both are null", () => {
    const diff = diffForkChatStates(null, null);
    expect(diff.cacheChanged).toBe(false);
    expect(diff.versionChanged).toBe(false);
    expect(diff.cacheFieldsChanged).toEqual([]);
    expect(diff.generatedAtMsDelta).toBe(0);
  });

  it("returns cacheChanged=false when both are undefined", () => {
    const diff = diffForkChatStates(undefined, undefined);
    expect(diff.cacheChanged).toBe(false);
    expect(diff.versionChanged).toBe(false);
    expect(diff.cacheFieldsChanged).toEqual([]);
    expect(diff.generatedAtMsDelta).toBe(0);
  });

  it("does not flag breakerPredicates or cooldownHelpers changes (cache-only diff)", () => {
    // The diff is intentionally limited to combosCache — the other
    // sections are static for a given fork revision.
    const a = makeSnapshot();
    const b = makeSnapshot({
      breakerPredicates: {
        ...a.breakerPredicates,
        size: 99,
      },
    });
    const diff = diffForkChatStates(a, b);
    expect(diff.cacheChanged).toBe(false);
    expect(diff.cacheFieldsChanged).toEqual([]);
  });

  it("cacheFieldsChanged order matches the iteration order (hasCachedPromise → cachedAtMs → cachedVersion → ttlMs)", () => {
    const a = makeSnapshot();
    const b = makeSnapshot({
      combosCache: {
        ...a.combosCache,
        ttlMs: 9999,
        cachedVersion: 5,
        cachedAtMs: 1000,
        hasCachedPromise: true,
      },
    });
    const diff = diffForkChatStates(a, b);
    expect(diff.cacheFieldsChanged).toEqual([
      "hasCachedPromise",
      "cachedAtMs",
      "cachedVersion",
      "ttlMs",
    ]);
  });
});

describe("chatForkState.formatForkChatStateForCli", () => {
  it("contains the version line", () => {
    const out = formatForkChatStateForCli();
    expect(out).toMatch(/^Fork Chat State v1\.0\.0/m);
  });

  it("contains the generatedAtMs line", () => {
    const out = formatForkChatStateForCli();
    expect(out).toMatch(/^generatedAtMs\s+\d+$/m);
  });

  it("contains the combosCache section", () => {
    const out = formatForkChatStateForCli();
    expect(out).toContain("combosCache.hasCachedPromise");
    expect(out).toContain("combosCache.cachedAtMs");
    expect(out).toContain("combosCache.cachedVersion");
    expect(out).toContain("combosCache.ttlMs");
  });

  it("contains the breakerPredicates section", () => {
    const out = formatForkChatStateForCli();
    expect(out).toContain("breakerPredicates.size");
    expect(out).toContain("breakerPredicates.statusCodes");
    expect(out).toContain("breakerPredicates.sampleTrue");
    expect(out).toContain("breakerPredicates.sampleFalse");
  });

  it("contains the cooldownHelpers section", () => {
    const out = formatForkChatStateForCli();
    expect(out).toContain("cooldownHelpers.formatSample");
    expect(out).toContain("cooldownHelpers.describeSample");
    expect(out).toContain("cooldownHelpers.noRetrySample");
  });

  it("contains the breaker status codes as a comma-separated list", () => {
    const out = formatForkChatStateForCli();
    expect(out).toContain("[408, 500, 502, 503, 504]");
  });

  it("contains the cooldown format sample (7500ms → 8s)", () => {
    const out = formatForkChatStateForCli();
    expect(out).toContain("7500ms → 8s");
  });

  it("accepts a custom snapshot argument", () => {
    const custom = {
      version: "9.9.9",
      generatedAtMs: 12345,
      combosCache: {
        hasCachedPromise: true,
        cachedAtMs: 1000,
        cachedVersion: 7,
        ttlMs: 10_000,
      },
      breakerPredicates: {
        statusCodes: [408, 500, 502, 503, 504],
        size: 5,
        sampleTrue: { status: 503, tripsBreaker: true },
        sampleFalse: { status: 200, tripsBreaker: false },
      },
      cooldownHelpers: {
        sampleFormatSeconds: { inputMs: 7500, outputSec: 8 },
        sampleDescribeWait: {
          input: { shouldRetry: true, waitMs: 7500 },
          output: "8s",
        },
        sampleNoRetry: { output: "no-retry" },
      },
    };
    const out = formatForkChatStateForCli(custom);
    expect(out).toContain("v9.9.9");
    expect(out).toContain("generatedAtMs           12345");
  });

  it("output is a non-empty string with multiple lines", () => {
    const out = formatForkChatStateForCli();
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    const lineCount = out.split("\n").length;
    expect(lineCount).toBeGreaterThanOrEqual(10);
  });

  it("output does not contain undefined or NaN", () => {
    const out = formatForkChatStateForCli();
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("NaN");
  });
});

describe("chatForkState integration: snapshot + diff + format", () => {
  it("snapshots taken across cache events produce meaningful diffs", () => {
    // Initial: cache miss
    const before = getForkChatState();
    expect(before.combosCache.hasCachedPromise).toBe(false);

    // Simulate a cache population
    const after: ForkChatStateSnapshot = {
      ...before,
      generatedAtMs: before.generatedAtMs + 100,
      combosCache: {
        ...before.combosCache,
        hasCachedPromise: true,
        cachedAtMs: before.generatedAtMs + 100,
        cachedVersion: 1,
      },
    };

    const diff = diffForkChatStates(before, after);
    expect(diff.cacheChanged).toBe(true);
    expect(diff.cacheFieldsChanged).toEqual([
      "hasCachedPromise",
      "cachedAtMs",
      "cachedVersion",
    ]);
    expect(diff.generatedAtMsDelta).toBe(100);

    const cliOut = formatForkChatStateForCli(after);
    expect(cliOut).toContain("combosCache.hasCachedPromise   true");
    expect(cliOut).toContain("combosCache.cachedVersion      1");
  });
});
