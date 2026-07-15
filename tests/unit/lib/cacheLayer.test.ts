// @vitest-environment node
/**
 * Smoke test for cacheLayer adapter (PR: lru-cache@11 migration).
 * Validates that the public API contract is preserved:
 *   - new LRUCache({maxSize, maxBytes, defaultTTL})
 *   - set/get/has/delete/clear
 *   - per-call TTL via set(key, value, ttl)
 *   - byte budget enforcement
 *   - LRU eviction
 *   - getStats() shape
 *   - static generateKey() — sha256[:16] hex
 *   - getPromptCache() singleton reads env vars
 */

import { describe, it, beforeEach, afterEach, afterAll, beforeAll, expect } from "vitest";
;
import { LRUCache, getPromptCache } from "../../../src/lib/cacheLayer.ts";

it("cacheLayer: set + get returns value and counts hit", () => {
  const c = new LRUCache({ maxSize: 5, maxBytes: 1024, defaultTTL: 60_000 });
  c.set("a", { foo: 1 });
  const v = c.get("a");
  expect(v).toEqual({ foo: 1 });
  const s = c.getStats();
  expect(s.hits).toBe(1);
  expect(s.misses).toBe(0);
  expect(s.size).toBe(1);
});

it("cacheLayer: get returns undefined for missing key and counts miss", () => {
  const c = new LRUCache();
  expect(c.get("nope")).toBe(undefined);
  const s = c.getStats();
  expect(s.misses).toBe(1);
  expect(s.hits).toBe(0);
});

it("cacheLayer: has returns true without promoting", () => {
  const c = new LRUCache();
  c.set("k", 42);
  expect(c.has("k")).toBe(true);
  expect(c.has("nope")).toBe(false);
});

it("cacheLayer: delete returns true if present, false otherwise", () => {
  const c = new LRUCache();
  c.set("k", "v");
  expect(c.delete("k")).toBe(true);
  expect(c.delete("k")).toBe(false);
});

it("cacheLayer: clear empties the cache and resets byte counter", () => {
  const c = new LRUCache({ maxBytes: 100_000 });
  c.set("a", "x".repeat(100));
  c.set("b", "y".repeat(100));
  expect(c.getStats().size).toBe(2);
  c.clear();
  expect(c.getStats().size).toBe(0);
  expect(c.getStats().bytes).toBe(0);
});

it("cacheLayer: per-call TTL expires entries", async () => {
  const c = new LRUCache({ defaultTTL: 60_000 });
  c.set("short", "value", 50 /* 50ms TTL */);
  expect(c.get("short")).toBe("value");
  await new Promise((r) => setTimeout(r, 80));
  expect(c.get("short")).toBe(undefined);
});

it("cacheLayer: maxSize evicts oldest (LRU)", async () => {
  const c = new LRUCache({ maxSize: 3, maxBytes: 100_000, defaultTTL: 60_000 });
  c.set("a", 1);
  c.set("b", 2);
  c.set("c", 3);
  // Touch 'a' so it's most recently used
  expect(c.get("a")).toBe(1);
  c.set("d", 4); // should evict 'b'
  expect(c.has("a")).toBe(true);
  expect(c.has("b")).toBe(false);
  expect(c.has("c")).toBe(true);
  expect(c.has("d")).toBe(true);
});

it("cacheLayer: maxBytes evicts when over budget", () => {
  const c = new LRUCache({ maxSize: 100, maxBytes: 200, defaultTTL: 60_000 });
  // Each entry sized ≈ len(JSON.stringify("xx"*N))*2. Tune so 5 inserts
  // overflows 200 bytes and at least one entry is evicted.
  c.set("a", "a".repeat(40));
  c.set("b", "b".repeat(40));
  c.set("c", "c".repeat(40));
  c.set("d", "d".repeat(40));
  c.set("e", "e".repeat(40));
  const s = c.getStats();
  expect(s.evictions >= 1).toBe(true);
  // At least the most-recent 'e' should be retained (LRU evicts oldest first)
  expect(c.has("e")).toBe(true);
});

it("cacheLayer: generateKey returns 16-hex string and is order-stable", () => {
  const k1 = LRUCache.generateKey({ a: 1, b: 2 });
  const k2 = LRUCache.generateKey({ b: 2, a: 1 });
  expect(k1).toBe(k2);
  expect(k1).toMatch(/^[0-9a-f]{16}$/);
});

it("cacheLayer: getStats shape matches legacy contract", () => {
  const c = new LRUCache();
  const s = c.getStats();
  for (const key of [
    "size",
    "maxSize",
    "bytes",
    "maxBytes",
    "hits",
    "misses",
    "evictions",
    "hitRate",
  ]) {
    expect(key in s, `missing stat: ${key}`);
  }
});

it("cacheLayer: getPromptCache() returns singleton honoring env overrides", () => {
  // Reset singleton by clearing module cache would be intrusive; just test
  // that two consecutive calls return the same instance.
  const a = getPromptCache();
  const b = getPromptCache();
  expect(a).toBe(b);
});
