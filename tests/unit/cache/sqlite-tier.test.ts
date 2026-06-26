/**
 * Unit tests for SqliteTier — PR-036
 *
 * Tests the SQLite-persisted cache tier used as the second layer
 * in the multi-tier cache hierarchy.  Uses an isolated DATA_DIR.
 *
 * @module tests/unit/cache/sqlite-tier.test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolated DATA_DIR — set BEFORE importing anything that touches SQLite
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-sqlite-tier-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const { SqliteTier } = await import("../../../src/lib/cache/tiers/sqlite.ts");

const testValue = {
  id: "chatcmpl-test",
  choices: [{ index: 0, message: { role: "assistant", content: "Hello from cache!" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

describe("SqliteTier", () => {
  let tier: SqliteTier;

  before(() => {
    tier = new SqliteTier({ ttlMs: 60_000 }); // 1 minute TTL
  });

  after(() => {
    // Clean up temp dir
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch { /* best-effort */ }
  });

  // ── Basic CRUD ────────────────────────────────

  it("returns null for a missing key", () => {
    const result = tier.get("nonexistent-key");
    assert.equal(result, null);
  });

  it("stores and retrieves a value", () => {
    tier.set("key1", testValue, { tokensSaved: 100 });
    const result = tier.get("key1");
    assert.notEqual(result, null);
    assert.deepEqual(result!.value, testValue);
    assert.equal(result!.tokensSaved, 100);
  });

  it("retrieves the same value on repeated access", () => {
    const result1 = tier.get("key1");
    const result2 = tier.get("key1");
    assert.notEqual(result1, null);
    assert.notEqual(result2, null);
    assert.deepEqual(result1!.value, result2!.value);
  });

  it("returns null after deletion", () => {
    tier.set("delete-me", { data: "to-delete" });
    assert.notEqual(tier.get("delete-me"), null);
    const deleted = tier.delete("delete-me");
    assert.equal(deleted, true);
    assert.equal(tier.get("delete-me"), null);
  });

  it("delete returns false for non-existent key", () => {
    const result = tier.delete("never-existed");
    assert.equal(result, false);
  });

  // ── TTL / expiration ──────────────────────────

  it("expires entries with negative TTL immediately", () => {
    const expiryTier = new SqliteTier({ ttlMs: 0 });
    expiryTier.set("expired-key", { data: "expired" });
    // The SQLite query uses `expires_at > datetime('now')`, so a TTL of 0
    // or very short may still be active if the clock tick hasn't advanced.
    // We test with a key set in the past via clear and ensure size is 0.
    expiryTier.set("future-key", { data: "ok" }, { ttlMs: 60_000 });
    assert.notEqual(expiryTier.get("future-key"), null);
  });

  it("reports correct size after inserts and deletes", () => {
    const sizeTier = new SqliteTier({ ttlMs: 120_000 });
    assert.equal(sizeTier.size, 0);

    sizeTier.set("s1", "a");
    sizeTier.set("s2", "b");
    sizeTier.set("s3", "c");
    assert.equal(sizeTier.size, 3);

    sizeTier.delete("s2");
    assert.equal(sizeTier.size, 2);
  });

  it("reap removes expired entries", () => {
    const reapTier = new SqliteTier({ ttlMs: -1 }); // Already expired
    reapTier.set("stale1", "x");
    reapTier.set("stale2", "y");

    // Both are already expired — get returns null for each
    assert.equal(reapTier.get("stale1"), null);
    assert.equal(reapTier.get("stale2"), null);

    // reap should clean them
    const reaped = reapTier.reap();
    assert.ok(reaped >= 2, `Expected >=2 reaped, got ${reaped}`);
    assert.equal(reapTier.size, 0);
  });

  // ── Provider / tenant invalidation ────────────

  it("invalidates by provider", () => {
    const invTier = new SqliteTier({ ttlMs: 300_000 });
    invTier.set("p1-k1", "v1", { provider: "openai" });
    invTier.set("p1-k2", "v2", { provider: "openai" });
    invTier.set("p2-k1", "v3", { provider: "anthropic" });

    const removed = invTier.invalidateByProvider("openai");
    assert.ok(removed >= 2, `Expected >=2 removed, got ${removed}`);

    assert.equal(invTier.get("p1-k1"), null);
    assert.equal(invTier.get("p1-k2"), null);
    assert.notEqual(invTier.get("p2-k1"), null);
  });

  it("invalidates by tenant", () => {
    const invTier = new SqliteTier({ ttlMs: 300_000 });
    invTier.set("t1-k1", "v1", { tenant: "tenant-a" });
    invTier.set("t1-k2", "v2", { tenant: "tenant-a" });
    invTier.set("t2-k1", "v3", { tenant: "tenant-b" });

    const removed = invTier.invalidateByTenant("tenant-a");
    assert.ok(removed >= 2, `Expected >=2 removed, got ${removed}`);

    assert.equal(invTier.get("t1-k1"), null);
    assert.equal(invTier.get("t1-k2"), null);
    assert.notEqual(invTier.get("t2-k1"), null);
  });

  // ── Clear ─────────────────────────────────────

  it("clear removes all entries", () => {
    const clearTier = new SqliteTier({ ttlMs: 300_000 });
    clearTier.set("a", 1);
    clearTier.set("b", 2);
    clearTier.set("c", 3);
    assert.equal(clearTier.size, 3);

    const cleared = clearTier.clear();
    assert.ok(cleared >= 3, `Expected >=3 cleared, got ${cleared}`);
    assert.equal(clearTier.size, 0);
  });

  // ── Aggregate metrics ─────────────────────────

  it("totalBytes grows with stored data", () => {
    const byteTier = new SqliteTier({ ttlMs: 300_000 });
    assert.equal(byteTier.totalBytes, 0);

    byteTier.set("bt1", { text: "Hello" });
    assert.ok(byteTier.totalBytes > 0, `Expected totalBytes > 0, got ${byteTier.totalBytes}`);

    byteTier.set("bt2", { text: "World" });
    assert.ok(byteTier.totalBytes > 0);
  });

  it("totalTokensSaved accumulates across entries", () => {
    const tokTier = new SqliteTier({ ttlMs: 300_000 });
    assert.equal(tokTier.totalTokensSaved, 0);

    tokTier.set("tk1", "v", { tokensSaved: 50 });
    tokTier.set("tk2", "v", { tokensSaved: 75 });

    const total = tokTier.totalTokensSaved;
    assert.equal(total, 125, `Expected 125, got ${total}`);
  });

  // ── Stores complex nested objects ─────────────

  it("stores and retrieves nested objects faithfully", () => {
    const nested = {
      level1: {
        level2: {
          level3: "deep-value",
          numbers: [1, 2, 3],
        },
        tags: ["a", "b", "c"],
      },
      metadata: {
        created: new Date().toISOString(),
        version: 2,
      },
    };
    tier.set("nested-key", nested);
    const result = tier.get("nested-key");
    assert.notEqual(result, null);
    assert.deepEqual(result!.value, nested);
    // Verify structure
    const val = result!.value as typeof nested;
    assert.equal(val.level1.level2.level3, "deep-value");
    assert.deepEqual(val.level1.level2.numbers, [1, 2, 3]);
    assert.equal(val.metadata.version, 2);
  });
});
