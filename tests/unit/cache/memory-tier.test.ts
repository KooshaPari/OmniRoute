/**
 * Unit tests for MemoryTier — PR-036
 *
 * Tests the in-memory LRU cache tier used as the first layer
 * in the multi-tier cache hierarchy.
 *
 * @module tests/unit/cache/memory-tier.test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryTier } from "../../../src/lib/cache/tiers/memory.ts";

describe("MemoryTier", () => {
  // ── Basic operations ────────────────────────────

  it("returns undefined for missing key", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    assert.equal(tier.get("nonexistent"), undefined);
  });

  it("stores and retrieves a value", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    tier.set("key1", { answer: 42 });
    const result = tier.get("key1") as { answer: number };
    assert.notEqual(result, undefined);
    assert.equal(result.answer, 42);
  });

  it("returns undefined for expired entry", () => {
    const tier = new MemoryTier({ maxSize: 10, defaultTTL: -1 }); // already expired
    tier.set("key1", "value");
    assert.equal(tier.get("key1"), undefined);
  });

  it("has() returns true for existing keys", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    tier.set("key1", "value");
    assert.equal(tier.has("key1"), true);
  });

  it("has() returns false for missing keys", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    assert.equal(tier.has("nope"), false);
  });

  it("delete() removes an entry", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    tier.set("key1", "value");
    assert.equal(tier.delete("key1"), true);
    assert.equal(tier.get("key1"), undefined);
  });

  it("delete() returns false for missing key", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    assert.equal(tier.delete("nope"), false);
  });

  it("clear() removes all entries", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    tier.set("a", 1);
    tier.set("b", 2);
    tier.clear();
    assert.equal(tier.size, 0);
    assert.equal(tier.get("a"), undefined);
    assert.equal(tier.get("b"), undefined);
  });

  // ── Eviction ────────────────────────────────────

  it("evicts oldest entry when maxSize is exceeded", () => {
    const tier = new MemoryTier({ maxSize: 3 });
    tier.set("a", 1);
    tier.set("b", 2);
    tier.set("c", 3);
    tier.set("d", 4); // should evict "a"
    assert.equal(tier.get("a"), undefined, "a should be evicted");
    assert.notEqual(tier.get("b"), undefined, "b should survive");
    assert.notEqual(tier.get("c"), undefined, "c should survive");
    assert.notEqual(tier.get("d"), undefined, "d should survive");
  });

  it("promotes accessed entries to MRU position", () => {
    const tier = new MemoryTier({ maxSize: 3 });
    tier.set("a", 1);
    tier.set("b", 2);
    tier.set("c", 3);
    // Access "a" to promote it
    tier.get("a");
    // Add "d" — should evict "b", not "a"
    tier.set("d", 4);
    assert.notEqual(tier.get("a"), undefined, "a should survive (promoted)");
    assert.equal(tier.get("b"), undefined, "b should be evicted");
  });

  // ── Stats ────────────────────────────────────────

  it("tracks hits and misses", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    tier.set("k", "v");
    tier.get("k"); // hit
    tier.get("k"); // hit
    tier.get("missing"); // miss
    const stats = tier.stats;
    assert.equal(stats.hits, 2);
    assert.equal(stats.misses, 1);
  });

  it("tracks evictions", () => {
    const tier = new MemoryTier({ maxSize: 2 });
    tier.set("a", 1);
    tier.set("b", 2);
    tier.set("c", 3); // evicts a
    const stats = tier.stats;
    assert.ok(stats.evictions >= 1);
  });

  it("reports correct hit rate", () => {
    const tier = new MemoryTier({ maxSize: 10 });
    tier.set("k", "v");
    tier.get("k"); // hit
    tier.get("missing"); // miss
    const stats = tier.stats;
    assert.equal(stats.hitRate, 50);
  });
});
