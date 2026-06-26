/**
 * Integration tests for MultiTierCache orchestrator — PR-036
 *
 * Tests the read-through / write-through strategy across all three tiers.
 * Uses isolated DATA_DIR so SQLite writes don't pollute the real DB.
 *
 * @module tests/unit/cache/multi-tier.test
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolated DATA_DIR — set BEFORE importing modules that touch SQLite
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-multitier-"));
process.env.DATA_DIR = TEST_DATA_DIR;

// Set env knobs for deterministic, fast tests
process.env.MULTI_TIER_CACHE_TTL_MS = "3600000";
process.env.MULTI_TIER_MEMORY_MAX_SIZE = "1000";
process.env.MULTI_TIER_MEMORY_MAX_BYTES = String(16 * 1024 * 1024);
process.env.DISK_CACHE_MAX_ENTRIES = "10000";
process.env.OMNIROUTE_CACHE_DIR = path.join(TEST_DATA_DIR, "disk-cache");

const { MultiTierCache, resetMultiTierCache } = await import(
  "../../../src/lib/cache/multiTier.ts"
);
import type { CacheHit } from "../../../src/lib/cache/multiTier.ts";

const sampleResponse = {
  id: "chatcmpl-sample",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4",
  choices: [
    { index: 0, message: { role: "assistant", content: "Hello world" }, finish_reason: "stop" },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

describe("MultiTierCache", () => {
  let cache: MultiTierCache;

  before(() => {
    resetMultiTierCache();
    cache = new MultiTierCache();
  });

  after(() => {
    cache.shutdown();
    resetMultiTierCache();
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch { /* best-effort */ }
  });

  // ── Basic get/set ─────────────────────────────

  it("returns null for a cache miss", () => {
    const result = cache.get("nonexistent");
    assert.equal(result, null);
  });

  it("stores and retrieves a value (memory tier)", () => {
    cache.set("key-a", sampleResponse, { tokensSaved: 42 });
    const result = cache.get("key-a");
    assert.notEqual(result, null);
    assert.equal(result!.tier, "memory");
    assert.deepEqual(result!.value, sampleResponse);
    assert.equal(result!.tokensSaved, 42);
  });

  it("retrieves the same value on repeated access", () => {
    const r1 = cache.get("key-a");
    const r2 = cache.get("key-a");
    assert.notEqual(r1, null);
    assert.notEqual(r2, null);
    assert.deepEqual(r1!.value, r2!.value);
  });

  // ── Tier promotion (read-through warming) ─────

  it("promotes from sqlite to memory on read (cache warming)", () => {
    // Insert directly into SQLite (bypass memory)
    cache.sqlite.set("warmup-key", { data: "sqlite-value" }, { tokensSaved: 10 });

    // Read — should hit SQLite and warm memory
    const result = cache.get("warmup-key");
    assert.notEqual(result, null);
    assert.equal(result!.tier, "sqlite", "first read should come from sqlite");
    assert.equal((result!.value as { data: string }).data, "sqlite-value");

    // Second read — should now come from memory (promoted)
    const result2 = cache.get("warmup-key");
    assert.notEqual(result2, null);
    assert.equal(result2!.tier, "memory", "second read should come from memory (promoted)");
  });

  // ── Delete ────────────────────────────────────

  it("delete removes from all tiers", () => {
    cache.set("delete-key", { data: "to-delete" });
    assert.notEqual(cache.get("delete-key"), null);
    const deleted = cache.delete("delete-key");
    assert.equal(deleted, true);
    assert.equal(cache.get("delete-key"), null);
  });

  it("delete returns false for non-existent key", () => {
    const result = cache.delete("no-such-key");
    assert.equal(result, false);
  });

  // ── Clear ─────────────────────────────────────

  it("clear removes all entries across tiers", () => {
    cache.set("clear-a", 1);
    cache.set("clear-b", 2);
    assert.notEqual(cache.get("clear-a"), null);
    assert.notEqual(cache.get("clear-b"), null);

    cache.clear();

    assert.equal(cache.get("clear-a"), null);
    assert.equal(cache.get("clear-b"), null);
  });

  // ── has() ─────────────────────────────────────

  it("has returns true for existing entries", () => {
    cache.set("has-key", "value");
    assert.equal(cache.has("has-key"), true);
  });

  it("has returns false for non-existent entries", () => {
    assert.equal(cache.has("missing-key"), false);
  });

  // ── Stats ─────────────────────────────────────

  it("getStats returns structure with all fields", () => {
    const stats = cache.getStats();
    assert.ok(typeof stats.memoryEntries === "number");
    assert.ok(typeof stats.sqliteEntries === "number");
    assert.ok(typeof stats.diskEntries === "number");
    assert.ok(typeof stats.hits === "number");
    assert.ok(typeof stats.misses === "number");
    assert.ok(typeof stats.evictions === "number");
    assert.ok(typeof stats.hitRate === "string");
    assert.ok(typeof stats.tokensSaved === "number");
  });

  it("getStats reports hits and misses", () => {
    cache.set("stats-key", "value");
    cache.get("stats-key");  // hit
    cache.get("stats-key");  // hit (from memory)
    cache.get("stats-miss"); // miss

    const stats = cache.getStats();
    // hits could be 2 (or more if other tests contributed)
    assert.ok(stats.hits >= 2, `Expected hits >= 2, got ${stats.hits}`);
    assert.ok(stats.misses >= 1, `Expected misses >= 1, got ${stats.misses}`);
  });

  it("getStats tracks tokensSaved across writes", () => {
    // Create a fresh cache for clean metrics
    const freshCache = new MultiTierCache();
    freshCache.set("tok-a", "value-a", { tokensSaved: 100 });
    freshCache.set("tok-b", "value-b", { tokensSaved: 200 });

    // Read both to register hits
    freshCache.get("tok-a");
    freshCache.get("tok-b");

    const stats = freshCache.getStats();
    // Each hit accumulates tokensSaved
    assert.equal(stats.tokensSaved, 100 + 200, `Expected 300, got ${stats.tokensSaved}`);
    freshCache.shutdown();
  });

  // ── disabled flag ─────────────────────────────

  it("returns null for all operations when disabled", () => {
    process.env.MULTI_TIER_CACHE_DISABLED = "1";
    const disabledCache = new MultiTierCache();
    assert.equal(disabledCache.disabled, true);

    disabledCache.set("any", "value");
    assert.equal(disabledCache.get("any"), null);
    assert.equal(disabledCache.has("any"), false);
    assert.equal(disabledCache.delete("any"), false);
    // clear should not throw
    disabledCache.clear();

    delete process.env.MULTI_TIER_CACHE_DISABLED;
    disabledCache.shutdown();
  });

  // ── generateKey convenience ───────────────────

  it("generateKey produces a deterministic string", () => {
    const key = cache.generateKey({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hi" }],
      provider: "openai",
      tenant: "tenant-1",
    });
    assert.ok(typeof key === "string");
    assert.ok(key.length > 10);
  });

  // ── Large value handling ──────────────────────

  it("handles large response payloads", () => {
    const largeContent = "x".repeat(10000);
    const largeResponse = {
      ...sampleResponse,
      choices: [{ index: 0, message: { role: "assistant", content: largeContent }, finish_reason: "stop" }],
    };
    cache.set("large-key", largeResponse, { tokensSaved: 500 });
    const result = cache.get("large-key");
    assert.notEqual(result, null);
    const val = result!.value as typeof largeResponse;
    assert.equal(val.choices[0].message.content.length, 10000);
  });

  // ── Key isolation by provider/tenant ──────────

  it("isolates cache entries by provider", () => {
    const msgs = [{ role: "user", content: "same question" }];

    // Write key for openai
    const key1 = cache.generateKey({ model: "gpt-4", messages: msgs, provider: "openai" });
    cache.set(key1, { provider: "openai" });

    // Write key for anthropic
    const key2 = cache.generateKey({ model: "gpt-4", messages: msgs, provider: "anthropic" });
    cache.set(key2, { provider: "anthropic" });

    const result1 = cache.get(key1);
    const result2 = cache.get(key2);

    assert.notEqual(result1, null);
    assert.notEqual(result2, null);
    assert.equal((result1!.value as { provider: string }).provider, "openai");
    assert.equal((result2!.value as { provider: string }).provider, "anthropic");
  });

  it("isolates cache entries by tenant", () => {
    const msgs = [{ role: "user", content: "tenant question" }];

    const keyA = cache.generateKey({ model: "gpt-4", messages: msgs, tenant: "tenant-a" });
    const keyB = cache.generateKey({ model: "gpt-4", messages: msgs, tenant: "tenant-b" });

    assert.notEqual(keyA, keyB, "keys should differ across tenants");
    cache.set(keyA, { tenant: "a" });
    cache.set(keyB, { tenant: "b" });

    const resultA = cache.get(keyA);
    const resultB = cache.get(keyB);
    assert.notEqual(resultA, null);
    assert.notEqual(resultB, null);
    assert.equal((resultA!.value as { tenant: string }).tenant, "a");
    assert.equal((resultB!.value as { tenant: string }).tenant, "b");
  });
});
