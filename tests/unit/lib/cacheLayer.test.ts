// @vitest-environment node
/**
 * PR-B: cacheLayer.ts adapter (lru-cache@11) — public surface preservation tests.
 *
 * Validates that the rewritten LRUCache class + getPromptCache() singleton
 * preserve the exact API and behaviour that downstream consumers depend on.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LRUCache, getPromptCache, __resetPromptCacheForTests } from "@/lib/cacheLayer";

describe("cacheLayer LRUCache adapter", () => {
  beforeEach(() => __resetPromptCacheForTests());
  afterEach(() => __resetPromptCacheForTests());

  it("stores and returns values via set/get", () => {
    const c = new LRUCache<string, number>({ max: 4 });
    c.set("a", 1);
    c.set("b", 2);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBe(2);
    expect(c.get("missing")).toBeUndefined();
  });

  it("reports has() correctly", () => {
    const c = new LRUCache<string, number>({ max: 2 });
    c.set("x", 10);
    expect(c.has("x")).toBe(true);
    expect(c.has("y")).toBe(false);
  });

  it("delete() removes a key", () => {
    const c = new LRUCache<string, number>({ max: 2 });
    c.set("a", 1);
    expect(c.delete("a")).toBe(true);
    expect(c.has("a")).toBe(false);
    expect(c.delete("never")).toBe(false);
  });

  it("clear() empties the cache", () => {
    const c = new LRUCache<string, number>({ max: 4 });
    c.set("a", 1);
    c.set("b", 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.has("a")).toBe(false);
  });

  it("getStats() returns hits/misses/sets/deletes/evictions counters", () => {
    const c = new LRUCache<string, number>({ max: 4 });
    c.set("a", 1);
    c.get("a");      // hit
    c.get("nope");   // miss
    c.set("b", 2);
    c.delete("a");   // delete
    const stats = c.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(2);
    expect(stats.deletes).toBe(1);
    // size / currentBytes keys are required by the dashboard consumer
    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("currentBytes");
  });

  it("respects max via LRU eviction", () => {
    const c = new LRUCache<string, number>({ max: 2 });
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);            // evicts oldest ("a")
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
    expect(c.has("c")).toBe(true);
  });

  it("honours TTL when provided", async () => {
    const c = new LRUCache<string, number>({ max: 4, ttl: 20 /* ms */ });
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    await new Promise((r) => setTimeout(r, 35));
    expect(c.get("a")).toBeUndefined();
  });

  it("generateKey() produces deterministic namespaced keys", () => {
    const c = new LRUCache<string, number>({ max: 4 });
    const k1 = c.generateKey("prefix", { a: 1, b: 2 });
    const k2 = c.generateKey("prefix", { b: 2, a: 1 });   // key-order independence
    const k3 = c.generateKey("prefix", { a: 1, b: 3 });   // different value
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k1.startsWith("prefix:")).toBe(true);
  });

  it("getPromptCache() returns a singleton bound to env config", () => {
    process.env.PROMPT_CACHE_MAX_ENTRIES = "32";
    process.env.PROMPT_CACHE_TTL_MS = "60000";
    process.env.PROMPT_CACHE_MAX_BYTES = "1048576";
    const a = getPromptCache();
    const b = getPromptCache();
    expect(a).toBe(b);                    // identity
    a.set("prompt-key", { v: 1 });
    expect(b.get("prompt-key")).toEqual({ v: 1 });
    delete process.env.PROMPT_CACHE_MAX_ENTRIES;
    delete process.env.PROMPT_CACHE_TTL_MS;
    delete process.env.PROMPT_CACHE_MAX_BYTES;
  });
});