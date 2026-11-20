/**
 * chatCombosCache.test.ts — unit tests for PR-ι combos cache extraction.
 *
 * Verifies:
 *   - COMBOS_CACHE_TTL_MS = 10_000
 *   - First call hits getCombos and caches the Promise
 *   - Subsequent calls within TTL return the cached Promise (no extra getCombos call)
 *   - Cache busts when getCombosCacheVersion changes (#3147 fix)
 *   - Errors from getCombos are caught and return []
 *   - __resetCombosCacheForTests() clears state
 *   - __getCombosCacheStateForTests() returns correct snapshot
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock the localDb module before importing chatCombosCache.
let mockCombosReturn: unknown[] = [{ id: "default-combo" }];
let mockGetCombosCalls = 0;
let mockCacheVersion = 0;

vi.mock("@/lib/localDb", () => ({
  getCombos: vi.fn(async () => {
    mockGetCombosCalls += 1;
    return mockCombosReturn;
  }),
  getCombosCacheVersion: vi.fn(() => mockCacheVersion),
}));

import {
  COMBOS_CACHE_TTL_MS,
  getCombosCachedForChat,
  __resetCombosCacheForTests,
  __getCombosCacheStateForTests,
} from "../chatCombosCache";

describe("chatCombosCache.COMBOS_CACHE_TTL_MS", () => {
  it("is exactly 10_000", () => {
    expect(COMBOS_CACHE_TTL_MS).toBe(10_000);
  });

  it("is a positive integer", () => {
    expect(Number.isInteger(COMBOS_CACHE_TTL_MS)).toBe(true);
    expect(COMBOS_CACHE_TTL_MS).toBeGreaterThan(0);
  });
});

describe("chatCombosCache.getCombosCachedForChat", () => {
  beforeEach(() => {
    __resetCombosCacheForTests();
    mockCombosReturn = [{ id: "default-combo" }];
    mockGetCombosCalls = 0;
    mockCacheVersion = 0;
  });

  it("calls getCombos on first call and caches the result", async () => {
    const out = await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(1);
    expect(out).toEqual([{ id: "default-combo" }]);
  });

  it("returns the same array reference on the second call within TTL", async () => {
    const first = await getCombosCachedForChat();
    const second = await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(1);
    expect(first).toBe(second); // same reference (cached Promise)
  });

  it("dedupes concurrent in-flight calls", async () => {
    const [a, b, c] = await Promise.all([
      getCombosCachedForChat(),
      getCombosCachedForChat(),
      getCombosCachedForChat(),
    ]);
    expect(mockGetCombosCalls).toBe(1); // all 3 callers share one fetch
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("does not refetch when cache-version is unchanged", async () => {
    await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(1);

    // Change the return value but keep the version the same.
    // The cache should still serve the OLD value (the version is the invalidation key).
    mockCombosReturn = [{ id: "new-combo" }];
    const second = await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(1);
    expect(second).toEqual([{ id: "default-combo" }]); // still the old value
  });

  it("refetches when cache-version changes (#3147 invalidation)", async () => {
    await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(1);

    mockCacheVersion = 1;
    mockCombosReturn = [{ id: "post-edit-combo" }];
    const second = await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(2);
    expect(second).toEqual([{ id: "post-edit-combo" }]);
  });

  it("catches getCombos errors and returns []", async () => {
    // Force getCombos to throw.
    mockCombosReturn = (() => {
      throw new Error("localDb unavailable");
    }) as any;
    // Override the mock to throw instead.
    const localDb = await import("@/lib/localDb");
    vi.mocked(localDb.getCombos).mockImplementationOnce(async () => {
      throw new Error("localDb unavailable");
    });

    __resetCombosCacheForTests();
    const out = await getCombosCachedForChat();
    expect(out).toEqual([]);
  });

  it("caches the empty result from a caught error", async () => {
    const localDb = await import("@/lib/localDb");
    vi.mocked(localDb.getCombos).mockImplementation(async () => {
      throw new Error("nope");
    });

    __resetCombosCacheForTests();
    const first = await getCombosCachedForChat();
    expect(first).toEqual([]);

    // Restore a working mock that returns a non-empty array; but the
    // cache should still serve the cached empty array.
    vi.mocked(localDb.getCombos).mockImplementation(async () => [{ id: "fresh" }]);
    const second = await getCombosCachedForChat();
    expect(second).toEqual([]);
  });

  it("returns empty array (not undefined) when getCombos rejects", async () => {
    const localDb = await import("@/lib/localDb");
    vi.mocked(localDb.getCombos).mockImplementation(async () => {
      throw new Error("db down");
    });
    __resetCombosCacheForTests();

    const out = await getCombosCachedForChat();
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(0);
  });
});

describe("chatCombosCache.__resetCombosCacheForTests", () => {
  beforeEach(() => {
    __resetCombosCacheForTests();
    mockGetCombosCalls = 0;
    mockCacheVersion = 0;
    mockCombosReturn = [{ id: "default-combo" }];
  });

  it("clears the cached Promise", async () => {
    await getCombosCachedForChat();
    expect(__getCombosCacheStateForTests().hasCachedPromise).toBe(true);

    __resetCombosCacheForTests();
    expect(__getCombosCacheStateForTests().hasCachedPromise).toBe(false);
  });

  it("causes the next call to refetch", async () => {
    await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(1);

    __resetCombosCacheForTests();
    await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(2);
  });

  it("resets cachedAtMs to 0", async () => {
    await getCombosCachedForChat();
    expect(__getCombosCacheStateForTests().cachedAtMs).toBeGreaterThan(0);

    __resetCombosCacheForTests();
    expect(__getCombosCacheStateForTests().cachedAtMs).toBe(0);
  });

  it("resets cachedVersion to -1", async () => {
    mockCacheVersion = 5;
    await getCombosCachedForChat();
    expect(__getCombosCacheStateForTests().cachedVersion).toBe(5);

    __resetCombosCacheForTests();
    expect(__getCombosCacheStateForTests().cachedVersion).toBe(-1);
  });
});

describe("chatCombosCache.__getCombosCacheStateForTests", () => {
  beforeEach(() => {
    __resetCombosCacheForTests();
  });

  it("returns hasCachedPromise=false before any call", () => {
    const state = __getCombosCacheStateForTests();
    expect(state.hasCachedPromise).toBe(false);
    expect(state.cachedAtMs).toBe(0);
    expect(state.cachedVersion).toBe(-1);
  });

  it("returns hasCachedPromise=true after a successful call", async () => {
    await getCombosCachedForChat();
    const state = __getCombosCacheStateForTests();
    expect(state.hasCachedPromise).toBe(true);
    expect(state.cachedAtMs).toBeGreaterThan(0);
  });

  it("reflects the cache-version that was snapshotted", async () => {
    mockCacheVersion = 42;
    await getCombosCachedForChat();
    expect(__getCombosCacheStateForTests().cachedVersion).toBe(42);
  });

  it("cachedAtMs reflects Date.now() at the time of caching", async () => {
    const before = Date.now();
    await getCombosCachedForChat();
    const after = Date.now();

    const { cachedAtMs } = __getCombosCacheStateForTests();
    expect(cachedAtMs).toBeGreaterThanOrEqual(before);
    expect(cachedAtMs).toBeLessThanOrEqual(after);
  });

  it("returns an immutable-ish snapshot (callers can mutate freely)", async () => {
    await getCombosCachedForChat();
    const snap = __getCombosCacheStateForTests();
    expect(() => {
      (snap as any).hasCachedPromise = false;
    }).not.toThrow();

    // Calling again still shows hasCachedPromise=true because the
    // module state wasn't affected.
    expect(__getCombosCacheStateForTests().hasCachedPromise).toBe(true);
  });
});

describe("chatCombosCache integration: cache + version + reset", () => {
  beforeEach(() => {
    __resetCombosCacheForTests();
    mockGetCombosCalls = 0;
    mockCacheVersion = 0;
    mockCombosReturn = [{ id: "default-combo" }];
  });

  it("simulates a combo edit: TTL has not elapsed but version changed", async () => {
    // Read 1: cache populated
    const v1 = await getCombosCachedForChat();
    expect(v1).toEqual([{ id: "default-combo" }]);
    expect(mockGetCombosCalls).toBe(1);

    // Operator edits combo; cache-version bumps from 0 → 1
    mockCacheVersion = 1;
    mockCombosReturn = [{ id: "default-combo" }, { id: "new-target" }];

    // Read 2: cache busted by version, refetch happens
    const v2 = await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(2);
    expect(v2).toEqual([{ id: "default-combo" }, { id: "new-target" }]);

    // Read 3: cache populated again, no refetch
    const v3 = await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(2);
    expect(v3).toBe(v2);
  });

  it("simulates combo edit + reset: both invalidation paths clear cache", async () => {
    await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(1);

    // Reset path
    __resetCombosCacheForTests();
    await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(2);

    // Version path
    mockCacheVersion = 1;
    mockCombosReturn = [{ id: "v1-combo" }];
    await getCombosCachedForChat();
    expect(mockGetCombosCalls).toBe(3);
    expect(await getCombosCachedForChat()).toEqual([{ id: "v1-combo" }]);
    expect(mockGetCombosCalls).toBe(3); // still 3 (cached)
  });
});
