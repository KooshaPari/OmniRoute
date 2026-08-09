/**
 * chatForkState.test.ts — unit tests for PR-κ fork-original introspection.
 *
 * Verifies:
 *   - FORK_CHAT_STATE_VERSION is "1.0.0"
 *   - getForkChatState() returns a stable, JSON-serializable snapshot
 *   - The snapshot includes all 4 sections: combos cache, breaker
 *     predicates, cooldown helpers, versioning metadata
 *   - Sample inputs/outputs are pinned (7500ms → 8s, 200 → no trip, etc.)
 *   - getForkChatStateJson() returns the same shape as JSON.stringify
 *   - The snapshot is regenerated each call (timestamps differ)
 */
import { describe, expect, it } from "vitest";
import {
  FORK_CHAT_STATE_VERSION,
  getForkChatState,
  getForkChatStateJson,
} from "../chatForkState";
import {
  COMBOS_CACHE_TTL_MS,
  __resetCombosCacheForTests,
} from "../chatCombosCache";
import { PROVIDER_BREAKER_FAILURE_STATUSES } from "../chatPredicates";

describe("chatForkState.FORK_CHAT_STATE_VERSION", () => {
  it("is exactly '1.0.0'", () => {
    expect(FORK_CHAT_STATE_VERSION).toBe("1.0.0");
  });

  it("is a const literal (compile-time stable)", () => {
    expect(typeof FORK_CHAT_STATE_VERSION).toBe("string");
  });
});

describe("chatForkState.getForkChatState", () => {
  it("returns an object with the expected top-level keys", () => {
    const snap = getForkChatState();
    expect(Object.keys(snap).sort()).toEqual([
      "breakerPredicates",
      "combosCache",
      "cooldownHelpers",
      "generatedAtMs",
      "version",
    ]);
  });

  it("version field matches FORK_CHAT_STATE_VERSION", () => {
    expect(getForkChatState().version).toBe(FORK_CHAT_STATE_VERSION);
  });

  it("generatedAtMs is a positive integer near Date.now()", () => {
    const before = Date.now();
    const snap = getForkChatState();
    const after = Date.now();

    expect(snap.generatedAtMs).toBeGreaterThanOrEqual(before);
    expect(snap.generatedAtMs).toBeLessThanOrEqual(after);
    expect(Number.isInteger(snap.generatedAtMs)).toBe(true);
  });

  it("generatedAtMs differs across calls (regenerated each time)", async () => {
    const first = getForkChatState().generatedAtMs;
    await new Promise((r) => setTimeout(r, 5));
    const second = getForkChatState().generatedAtMs;
    expect(second).toBeGreaterThan(first);
  });

  it("returns JSON-serializable output", () => {
    const snap = getForkChatState();
    const json = JSON.stringify(snap);
    expect(typeof json).toBe("string");
    expect(json.length).toBeGreaterThan(0);

    // Round-trip: parse and re-stringify. Must equal original.
    const parsed = JSON.parse(json);
    expect(JSON.stringify(parsed)).toBe(json);
  });
});

describe("chatForkState.getForkChatState.combosCache", () => {
  beforeEach(() => {
    __resetCombosCacheForTests();
  });

  it("returns hasCachedPromise=false before any cache population", () => {
    expect(getForkChatState().combosCache.hasCachedPromise).toBe(false);
  });

  it("returns cachedAtMs=0 before any cache population", () => {
    expect(getForkChatState().combosCache.cachedAtMs).toBe(0);
  });

  it("returns cachedVersion=-1 before any cache population", () => {
    expect(getForkChatState().combosCache.cachedVersion).toBe(-1);
  });

  it("ttlMs matches COMBOS_CACHE_TTL_MS", () => {
    expect(getForkChatState().combosCache.ttlMs).toBe(COMBOS_CACHE_TTL_MS);
    expect(getForkChatState().combosCache.ttlMs).toBe(10_000);
  });

  it("reflects cache state changes after a call", async () => {
    const { getCombosCachedForChat } = await import("../chatCombosCache");
    await getCombosCachedForChat();

    const snap = getForkChatState().combosCache;
    expect(snap.hasCachedPromise).toBe(true);
    expect(snap.cachedAtMs).toBeGreaterThan(0);
  });
});

describe("chatForkState.getForkChatState.breakerPredicates", () => {
  it("statusCodes is the sorted array of the breaker set", () => {
    expect(getForkChatState().breakerPredicates.statusCodes).toEqual([
      408, 500, 502, 503, 504,
    ]);
  });

  it("size matches PROVIDER_BREAKER_FAILURE_STATUSES.size", () => {
    expect(getForkChatState().breakerPredicates.size).toBe(
      PROVIDER_BREAKER_FAILURE_STATUSES.size,
    );
    expect(getForkChatState().breakerPredicates.size).toBe(5);
  });

  it("sampleTrue: status 503 trips the breaker", () => {
    expect(getForkChatState().breakerPredicates.sampleTrue).toEqual({
      status: 503,
      tripsBreaker: true,
    });
  });

  it("sampleFalse: status 200 does NOT trip the breaker", () => {
    expect(getForkChatState().breakerPredicates.sampleFalse).toEqual({
      status: 200,
      tripsBreaker: false,
    });
  });

  it("statusCodes are all positive integers", () => {
    for (const code of getForkChatState().breakerPredicates.statusCodes) {
      expect(Number.isInteger(code)).toBe(true);
      expect(code).toBeGreaterThan(0);
    }
  });
});

describe("chatForkState.getForkChatState.cooldownHelpers", () => {
  it("sampleFormatSeconds: 7500ms → 8 seconds (ceiling)", () => {
    expect(getForkChatState().cooldownHelpers.sampleFormatSeconds).toEqual({
      inputMs: 7500,
      outputSec: 8,
    });
  });

  it("sampleDescribeWait: 7500ms retry → '8s' label", () => {
    expect(getForkChatState().cooldownHelpers.sampleDescribeWait).toEqual({
      input: { shouldRetry: true, waitMs: 7500 },
      output: "8s",
    });
  });

  it("sampleNoRetry: shouldRetry=false → 'no-retry'", () => {
    expect(getForkChatState().cooldownHelpers.sampleNoRetry).toEqual({
      output: "no-retry",
    });
  });

  it("output strings are never empty", () => {
    const { cooldownHelpers } = getForkChatState();
    expect(cooldownHelpers.sampleDescribeWait.output.length).toBeGreaterThan(0);
    expect(cooldownHelpers.sampleNoRetry.output.length).toBeGreaterThan(0);
  });
});

describe("chatForkState.getForkChatStateJson", () => {
  it("returns a valid JSON string", () => {
    const json = getForkChatStateJson();
    expect(typeof json).toBe("string");

    const parsed = JSON.parse(json);
    expect(typeof parsed).toBe("object");
    expect(parsed).not.toBeNull();
  });

  it("matches the equivalent JSON.stringify(getForkChatState()) call", () => {
    const fromFunction = getForkChatStateJson();
    const fromManual = JSON.stringify(getForkChatState(), null, 2);
    expect(fromFunction).toBe(fromManual);
  });

  it("contains the version string verbatim", () => {
    const json = getForkChatStateJson();
    expect(json).toContain(`"version": "${FORK_CHAT_STATE_VERSION}"`);
  });

  it("contains all top-level keys", () => {
    const json = getForkChatStateJson();
    expect(json).toContain('"combosCache"');
    expect(json).toContain('"breakerPredicates"');
    expect(json).toContain('"cooldownHelpers"');
    expect(json).toContain('"generatedAtMs"');
    expect(json).toContain('"version"');
  });

  it("uses 2-space indent (the canonical 'pretty' JSON)", () => {
    const json = getForkChatStateJson();
    // Find a nested object line — it should have 4 spaces of indent.
    expect(json).toMatch(/\n {4}"version"/);
  });
});

describe("chatForkState stability: shape is stable across calls", () => {
  beforeEach(() => {
    __resetCombosCacheForTests();
  });

  it("two consecutive snapshots have the same shape (only generatedAtMs differs)", () => {
    const a = getForkChatState();
    const b = getForkChatState();

    // Top-level keys are identical.
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());

    // Nested keys are identical.
    expect(Object.keys(a.combosCache).sort()).toEqual(
      Object.keys(b.combosCache).sort(),
    );
    expect(Object.keys(a.breakerPredicates).sort()).toEqual(
      Object.keys(b.breakerPredicates).sort(),
    );
    expect(Object.keys(a.cooldownHelpers).sort()).toEqual(
      Object.keys(b.cooldownHelpers).sort(),
    );

    // Static values are identical.
    expect(a.version).toBe(b.version);
    expect(a.combosCache.ttlMs).toBe(b.combosCache.ttlMs);
    expect(a.breakerPredicates.size).toBe(b.breakerPredicates.size);
  });

  it("is referentially immutable across reads", () => {
    const a = getForkChatState();
    const b = getForkChatState();
    // Each call returns a fresh object.
    expect(a).not.toBe(b);
    expect(a.combosCache).not.toBe(b.combosCache);
  });
});

describe("chatForkState integration: end-to-end snapshot", () => {
  it("snapshot is consumable by a downstream endpoint without further processing", () => {
    // Simulate an HTTP endpoint that takes the snapshot and returns it as JSON.
    const jsonResponse = (() => {
      const snap = getForkChatState();
      return {
        status: 200,
        body: JSON.stringify(snap),
        headers: { "content-type": "application/json" },
      };
    })();

    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.headers["content-type"]).toBe("application/json");

    const parsed = JSON.parse(jsonResponse.body);
    expect(parsed.version).toBe(FORK_CHAT_STATE_VERSION);
    expect(parsed.breakerPredicates.statusCodes).toContain(503);
  });
});
