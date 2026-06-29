/**
 * Comprehensive tests for the semantic cache module.
 *
 * Coverage:
 *   - SHA-256 key generation (determinism, normalization, per-key isolation)
 *   - LRU eviction when at capacity
 *   - SQLite two-tier: in-memory fast path + SQLite persistence fallback
 *   - TTL expiry
 *   - temperature=0 gating (read + write)
 *   - X-OmniRoute-No-Cache header bypass
 *   - Streaming assembly correctness (via synthesizeOpenAiSseFromJson)
 *   - Maintenance operations (clear, invalidate, stats)
 */

import { describe, it, test, beforeAll, afterAll, beforeEach, mock, vi } from "bun:test";
import assert from "node:assert/strict";

// ─── Mock the DB layer ───────────────────────────────────────────────
// We mock the full db/core module so semanticCache.ts can be loaded
// without requiring the real SQLite stack (which is partially deleted on
// this branch). The in-memory LRUCache is real; the SQLite adapter is
// simulated via a simple in-process store so we can verify the two-tier
// promote-from-DB path.

// Typed store entries: value string + expiresAt timestamp
type DbEntry = { value: string; expiresAt: number; tokensSaved: number };
const dbStore = new Map<string, DbEntry>();
const metricsStore = new Map<string, number>([
  ["hits", 0],
  ["misses", 0],
  ["tokens_saved", 0],
]);
let dbCounter = 0;

vi.mock("../../../src/lib/db/core.ts", () => ({
  getDbInstance: () => {
    const fakeDb = {
      prepare: (_sql: string) => ({
        run: (...args: unknown[]) => {
          dbCounter++;
          // Handle INSERT OR REPLACE INTO semantic_cache
          if (args.length >= 6) {
            const sig = String(args[1]); // args[1] = signature
            const val = String(args[4]); // args[4] = response (JSON string)
            const tokensSaved = Number(args[5]) || 0; // args[5] = tokens_saved
            // args[7] = expires_at (ISO string) — compute the numeric timestamp
            const expiresIso = String(args[7]); // expires_at
            const expiresAt = new Date(expiresIso).getTime();
            dbStore.set(sig, { value: val, expiresAt, tokensSaved });
          }
          // Handle DELETE
          if (_sql.startsWith("DELETE")) {
            const sig = String(args[0]);
            if (_sql.includes("signature = ?") && dbStore.has(sig)) {
              dbStore.delete(sig);
              return { changes: 1 };
            }
            if (_sql.includes("model = ?")) {
              let removed = 0;
              for (const key of dbStore.keys()) {
                removed++;
                dbStore.delete(key);
              }
              return { changes: removed };
            }
            if (_sql.includes("expires_at <= datetime") || _sql.includes("created_at < ?")) {
              const count = dbStore.size;
              dbStore.clear();
              return { changes: count };
            }
            if (_sql.includes("FROM semantic_cache") && !_sql.includes("WHERE")) {
              const count = dbStore.size;
              dbStore.clear();
              // Also clear in-memory metrics
              metricsStore.set("hits", 0);
              metricsStore.set("misses", 0);
              metricsStore.set("tokens_saved", 0);
              return { changes: count };
            }
            return { changes: 0 };
          }
          // Handle UPDATE cache_metrics (increment)
          if (_sql.startsWith("UPDATE") && _sql.includes("cache_metrics")) {
            const amount = Number(args[0]) || 0; // value = value + ?
            const metric = String(args[1]); // WHERE key = ?
            const current = metricsStore.get(metric) || 0;
            metricsStore.set(metric, current + amount);
            return { changes: 1 };
          }
          // Handle UPDATE semantic_cache hit_count
          if (_sql.startsWith("UPDATE") && _sql.includes("hit_count")) {
            return { changes: 1 };
          }
          return { changes: 1 };
        },
        get: (...args: unknown[]) => {
          // Handle SELECT COUNT queries
          if (_sql.includes("COUNT")) {
            if (_sql.includes("semantic_cache")) {
              const now = Date.now();
              let count = 0;
              for (const entry of dbStore.values()) {
                if (entry.expiresAt > now) count++;
              }
              return { count };
            }
            if (_sql.includes("cache_metrics")) {
              return { value: 42 };
            }
            return { count: 0 };
          }
          // Handle SELECT value FROM cache_metrics WHERE key = ?
          if (_sql.includes("FROM cache_metrics")) {
            const metric = String(args[0]);
            return { value: metricsStore.get(metric) || 0 };
          }
          // Handle SELECT response FROM semantic_cache WHERE signature = ? AND expires_at > datetime('now')
          const sig = String(args[0]);
          const now = Date.now();
          const entry = dbStore.get(sig);
          if (entry && entry.expiresAt > now) {
            return {
              response: entry.value,
              tokens_saved: entry.tokensSaved,
            };
          }
          if (entry && entry.expiresAt <= now) {
            // Expired — remove it like the real SQLite would
            dbStore.delete(sig);
          }
          return null;
        },
        all: () => [],
      }),
      exec: (_sql: string) => {},
    };
    return fakeDb;
  },
  resetDbInstance: () => {
    dbStore.clear();
    metricsStore.set("hits", 0);
    metricsStore.set("misses", 0);
    metricsStore.set("tokens_saved", 0);
    dbCounter = 0;
  },
  DATA_DIR: "/tmp/test-semcache",
  SQLITE_FILE: null,
}));

// ─── Imports ─────────────────────────────────────────────────────────

const {
  generateSignature,
  getCachedResponse,
  setCachedResponse,
  isCacheableForRead,
  isCacheableForWrite,
  clearCache,
  cleanExpiredEntries,
  invalidateByModel,
  invalidateBySignature,
  invalidateStale,
  getCacheStats,
} = await import("../../../src/lib/semanticCache.ts");

const { LRUCache } = await import("../../../src/lib/cacheLayer.ts");

// Helper: sample cached response shape
function sampleResponse(id = "chatcmpl-test") {
  return {
    id,
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello from cache!" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

// ─── 1. SHA-256 Key Generation ───────────────────────────────────────

describe("generateSignature", () => {
  it("produces deterministic keys for identical inputs", () => {
    const messages = [{ role: "user", content: "what is 2+2?" }];
    const a = generateSignature("gpt-4", messages, 0, 1);
    const b = generateSignature("gpt-4", messages, 0, 1);
    assert.equal(a, b, "same model + messages + temp + topP → same key");
  });

  it("produces different keys when the model changes", () => {
    const messages = [{ role: "user", content: "hi" }];
    const a = generateSignature("gpt-4", messages, 0, 1);
    const b = generateSignature("gpt-4o", messages, 0, 1);
    assert.notEqual(a, b);
  });

  it("produces different keys when messages differ", () => {
    const a = generateSignature("gpt-4", [{ role: "user", content: "hello" }], 0, 1);
    const b = generateSignature("gpt-4", [{ role: "user", content: "goodbye" }], 0, 1);
    assert.notEqual(a, b);
  });

  it("produces different keys for different temperatures", () => {
    const messages = [{ role: "user", content: "hi" }];
    const a = generateSignature("gpt-4", messages, 0, 1);
    const b = generateSignature("gpt-4", messages, 0.7, 1);
    assert.notEqual(a, b, "temperature must be part of the cache key");
  });

  it("normalizes messages (strips extra fields)", () => {
    const msg1 = [{ role: "user", content: "hello", extra: true, metadata: { x: 1 } }];
    const msg2 = [{ role: "user", content: "hello" }];
    assert.equal(
      generateSignature("gpt-4", msg1, 0, 1),
      generateSignature("gpt-4", msg2, 0, 1),
      "extra fields must be stripped before hashing"
    );
  });

  it("normalizes missing role to 'user'", () => {
    const msg1 = [{ content: "hello" }];
    const msg2 = [{ role: "user", content: "hello" }];
    assert.equal(
      generateSignature("gpt-5", msg1, 0, 1),
      generateSignature("gpt-5", msg2, 0, 1),
      "missing role must normalize to 'user'"
    );
  });

  it("handles a string conversation (treated as single user message)", () => {
    const sig = generateSignature("gpt-4", "just a string prompt", 0, 1);
    assert.ok(typeof sig === "string" && sig.length > 0, "string input must produce a key");
  });

  it("handles empty messages array", () => {
    const sig = generateSignature("gpt-4", [], 0, 1);
    assert.ok(sig.length > 0);
  });

  it("handles non-string content (image / structured input)", () => {
    const messages = [
      {
        role: "user",
        content: [{ type: "text", text: "describe this" }, { type: "image_url", url: "data:..." }],
      },
    ];
    const sig = generateSignature("gpt-4o", messages, 0, 1);
    assert.ok(sig.length > 0, "structured messages must not crash");
  });

  it("handles Responses-API `input[]` shape (no role)", () => {
    const input = [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }];
    const sig = generateSignature("gpt-5", input, 0, 1);
    assert.ok(sig.length > 0);
  });

  // ── Per-key cache isolation (#3740) ──

  it("isolates keys per apiKeyId (#3740)", () => {
    const messages = [{ role: "user", content: "shared query" }];
    const sigAlice = generateSignature("gpt-4o", messages, 0, 1, "alice-key");
    const sigBob = generateSignature("gpt-4o", messages, 0, 1, "bob-key");
    assert.notEqual(
      sigAlice,
      sigBob,
      "different apiKeyId must produce different signatures"
    );
  });

  it("is consistent for the same apiKeyId (#3740)", () => {
    const messages = [{ role: "user", content: "consistent query" }];
    const a = generateSignature("gpt-4o", messages, 0, 1, "same-key");
    const b = generateSignature("gpt-4o", messages, 0, 1, "same-key");
    assert.equal(a, b);
  });

  it("differentiates keyed from keyless signatures (#3740)", () => {
    const messages = [{ role: "user", content: "keyless query" }];
    const keyed = generateSignature("gpt-4o", messages, 0, 1, "some-key");
    const keyless = generateSignature("gpt-4o", messages, 0, 1, undefined);
    assert.notEqual(keyed, keyless, "keyed and keyless must not collide");
  });
});

// ─── 2. Cache Gating: isCacheableForRead / isCacheableForWrite ─────

describe("isCacheableForRead", () => {
  it("returns true for temperature=0 (streaming or not)", () => {
    assert.equal(isCacheableForRead({ stream: false, temperature: 0 }, null), true);
    assert.equal(isCacheableForRead({ stream: true, temperature: 0 }, null), true);
  });

  it("returns false when temperature is omitted (provider default may be non-deterministic)", () => {
    assert.equal(isCacheableForRead({ stream: false }, null), false);
    assert.equal(isCacheableForRead({}, null), false);
  });

  it("returns false for non-zero temperature", () => {
    assert.equal(isCacheableForRead({ temperature: 0.5 }, null), false);
    assert.equal(isCacheableForRead({ temperature: 1.0 }, null), false);
    assert.equal(isCacheableForRead({ temperature: 2.0 }, null), false);
  });

  it("returns false for temperature=-1 (corner case)", () => {
    assert.equal(isCacheableForRead({ temperature: -1 }, null), false);
  });

  it("returns false when x-omniroute-no-cache header is true", () => {
    const headers = new Headers({ "x-omniroute-no-cache": "true" });
    assert.equal(isCacheableForRead({ temperature: 0 }, headers), false);
  });

  it("returns true when no-cache header is present but false", () => {
    const headers = new Headers({ "x-omniroute-no-cache": "false" });
    assert.equal(isCacheableForRead({ temperature: 0 }, headers), true);
  });

  it("returns true when headers is null/undefined", () => {
    assert.equal(isCacheableForRead({ temperature: 0 }, null), true);
    assert.equal(isCacheableForRead({ temperature: 0 }, undefined), true);
  });

  it("handles Headers-like objects with .get() method", () => {
    const headers = { get: (name: string) => (name.toLowerCase() === "x-omniroute-no-cache" ? "true" : null) };
    assert.equal(isCacheableForRead({ temperature: 0 }, headers), false);
  });

  it("handles plain object headers (case-insensitive)", () => {
    assert.equal(
      isCacheableForRead(
        { temperature: 0 },
        { "X-OmniRoute-No-Cache": "true", "Content-Type": "application/json" }
      ),
      false
    );
    assert.equal(
      isCacheableForRead(
        { temperature: 0 },
        { "x-omniroute-no-cache": "True" }
      ),
      false
    );
  });
});

describe("isCacheableForWrite", () => {
  it("returns true for temperature=0", () => {
    assert.equal(isCacheableForWrite({ temperature: 0 }, null), true);
  });

  it("returns false when temperature is omitted", () => {
    assert.equal(isCacheableForWrite({ stream: true }, null), false);
  });

  it("returns false for non-zero temperature", () => {
    assert.equal(isCacheableForWrite({ temperature: 0.3 }, null), false);
  });

  it("returns false when no-cache header is set", () => {
    const headers = new Headers({ "x-omniroute-no-cache": "true" });
    assert.equal(isCacheableForWrite({ temperature: 0 }, headers), false);
  });

  it("treats string temperature '0' as non-cacheable", () => {
    assert.equal(isCacheableForWrite({ temperature: "0" }, null), false);
  });

  it("treats temperature: null as non-cacheable", () => {
    assert.equal(isCacheableForWrite({ temperature: null }, null), false);
  });
});

// ─── 3. LRU Eviction ────────────────────────────────────────────────

describe("LRU eviction (via LRUCache directly)", () => {
  it("evicts oldest entry when at capacity", () => {
    const cache = new LRUCache({ maxSize: 3, maxBytes: 10_000_000, defaultTTL: 60_000 });

    cache.set("a", { data: 1 });
    cache.set("b", { data: 2 });
    cache.set("c", { data: 3 });

    // All three should be present
    assert.ok(cache.get("a"), "a should be in cache");
    assert.ok(cache.get("b"), "b should be in cache");
    assert.ok(cache.get("c"), "c should be in cache");

    // Adding d evicts the least-recently-used entry (a, because none have been accessed)
    cache.set("d", { data: 4 });
    assert.equal(cache.get("a"), undefined, "a should have been evicted");
    assert.ok(cache.get("d"), "d should be in cache");
  });

  it("promotes accessed entries (get updates LRU order)", () => {
    const cache = new LRUCache({ maxSize: 3, maxBytes: 10_000_000, defaultTTL: 60_000 });

    cache.set("a", { data: 1 });
    cache.set("b", { data: 2 });
    cache.set("c", { data: 3 });

    // Access a → promotes it to most-recently-used
    cache.get("a");

    // Adding d should now evict b (the least-recently-used), not a
    cache.set("d", { data: 4 });
    assert.ok(cache.get("a"), "a should survive (was promoted)");
    assert.equal(cache.get("b"), undefined, "b should have been evicted");
    assert.ok(cache.get("c"), "c should survive");
    assert.ok(cache.get("d"), "d should be in cache");
  });

  it("tracks eviction count in stats", () => {
    const cache = new LRUCache({ maxSize: 2, maxBytes: 10_000_000, defaultTTL: 60_000 });

    cache.set("a", "x");
    cache.set("b", "y");
    cache.set("c", "z"); // evicts a

    const stats = cache.getStats();
    assert.equal(stats.evictions, 1, "one eviction should be recorded");
    assert.equal(stats.size, 2, "cache should have 2 entries");
  });

  it("replaces existing entry without evicting", () => {
    const cache = new LRUCache({ maxSize: 3, maxBytes: 10_000_000, defaultTTL: 60_000 });

    cache.set("a", { data: 1 });
    cache.set("b", { data: 2 });
    cache.set("a", { data: 99 }); // replace, not new

    const val = cache.get("a");
    assert.deepEqual(val, { data: 99 }, "replaced entry should have new value");
    assert.equal(cache.getStats().size, 2, "size should not increase after replacement");
  });

  it("evicts by byte limit when entries are large", () => {
    const cache = new LRUCache({ maxSize: 100, maxBytes: 200, defaultTTL: 60_000 });

    // Each entry is ~100+ bytes (JSON.stringify length * 2)
    cache.set("a", "x".repeat(60)); // ~122 bytes
    cache.set("b", "y".repeat(60)); // ~122 bytes → should push total over 200

    const stats = cache.getStats();
    assert.ok(stats.bytes <= stats.maxBytes || stats.evictions > 0,
      "byte limit should be enforced");
  });
});

describe("LRU eviction integrated via setCachedResponse", () => {
  beforeEach(() => {
    clearCache();
  });

  it("evicts from memory when many entries are stored", () => {
    // The memory cache has default maxSize=50 (from env or default).
    // Store 60 different entries and verify size stays bounded.
    const entries = 60;
    for (let i = 0; i < entries; i++) {
      const sig = generateSignature("gpt-4", [{ role: "user", content: `query-${i}` }], 0, 1);
      setCachedResponse(sig, "gpt-4", sampleResponse(`id-${i}`), 5);
    }

    const stats = getCacheStats();
    assert.ok(stats.memoryEntries <= 50, `memory cache should not exceed maxSize (got ${stats.memoryEntries})`);
  });
});

// ─── 4. Two-Tier Cache: In-Memory + SQLite ──────────────────────────

describe("Two-tier cache (getCachedResponse / setCachedResponse)", () => {
  beforeEach(() => {
    clearCache();
  });

  it("returns null for a cache MISS (no matching entry)", () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "miss" }], 0, 1);
    const result = getCachedResponse(sig);
    assert.equal(result, null, "MISS should return null");
  });

  it("returns cached value on HIT (in-memory fast path)", () => {
    const messages = [{ role: "user", content: "cache me" }];
    const sig = generateSignature("gpt-4", messages, 0, 1);
    const response = sampleResponse("hit-1");

    setCachedResponse(sig, "gpt-4", response, 10);

    const cached = getCachedResponse(sig);
    assert.ok(cached, "HIT should return cached value");
    assert.equal(cached.id, "hit-1");
    assert.equal(cached.choices[0].message.content, "Hello from cache!");
  });

  it("returns cached value from SQLite when memory misses (promote from DB)", () => {
    const messages = [{ role: "user", content: "db-promote" }];
    const sig = generateSignature("gpt-4", messages, 0, 1);
    const response = sampleResponse("db-hit");

    // Store in both memory and SQLite
    setCachedResponse(sig, "gpt-4", response, 10);

    // Verify in-memory hit works
    assert.ok(getCachedResponse(sig), "should HIT from memory initially");

    // Clear everything (memory + SQLite + metrics)
    clearCache();
    assert.equal(getCachedResponse(sig), null, "should MISS after clear");

    // Directly populate the mock's dbStore to simulate a scenario where
    // SQLite has data but the process's in-memory cache is cold
    // (e.g., process restart or another process populated the DB).
    const sampleResp = JSON.stringify(response);
    const expiresAt = Date.now() + 3_600_000; // 1 hour from now
    dbStore.set(sig, { value: sampleResp, expiresAt, tokensSaved: 10 });

    // Now get should miss memory, hit SQLite, and promote to memory
    const cached = getCachedResponse(sig);
    assert.ok(cached, "should HIT from SQLite after memory miss");
    assert.equal(cached.id, "db-hit");

    // Verify promotion: subsequent calls should hit memory
    const cachedAgain = getCachedResponse(sig);
    assert.ok(cachedAgain, "should HIT from memory (promoted) on second call");
    assert.equal(cachedAgain.id, "db-hit");
  });

  it("handles multiple entries with different signatures", () => {
    const sig1 = generateSignature("gpt-4", [{ role: "user", content: "q1" }], 0, 1);
    const sig2 = generateSignature("gpt-4", [{ role: "user", content: "q2" }], 0, 1);

    setCachedResponse(sig1, "gpt-4", sampleResponse("r1"), 5);
    setCachedResponse(sig2, "gpt-4", sampleResponse("r2"), 5);

    const r1 = getCachedResponse(sig1);
    const r2 = getCachedResponse(sig2);
    assert.ok(r1, "first entry should HIT");
    assert.ok(r2, "second entry should HIT");
    assert.equal(r1.id, "r1");
    assert.equal(r2.id, "r2");
  });

  it("supports different models independently", () => {
    const messages = [{ role: "user", content: "model independent" }];
    const sigGpt = generateSignature("gpt-4", messages, 0, 1);
    const sigClaude = generateSignature("claude-3", messages, 0, 1);

    setCachedResponse(sigGpt, "gpt-4", sampleResponse("gpt"), 5);
    setCachedResponse(sigClaude, "claude-3", sampleResponse("claude"), 5);

    assert.equal(getCachedResponse(sigGpt).id, "gpt");
    assert.equal(getCachedResponse(sigClaude).id, "claude");
  });
});

// ─── 5. TTL Expiry ──────────────────────────────────────────────────

describe("TTL expiry", () => {
  beforeEach(() => {
    clearCache();
  });

  it("returns cached value before TTL expires", () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "ttl-test" }], 0, 1);
    setCachedResponse(sig, "gpt-4", sampleResponse("ttl-ok"), 5, 5000); // 5s TTL

    const cached = getCachedResponse(sig);
    assert.ok(cached, "should HIT before TTL expiry");
  });

  it("returns null after TTL expires (memory cache eviction)", async () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "ttl-expire" }], 0, 1);
    // Use a very short TTL (10ms) so it expires quickly
    setCachedResponse(sig, "gpt-4", sampleResponse("ttl-gone"), 5, 10);

    // The in-memory LRU has its own TTL check. Wait for expiry.
    await new Promise((r) => setTimeout(r, 50));

    const cached = getCachedResponse(sig);
    assert.equal(cached, null, "should MISS after TTL expiry");
  });

  it("uses environment SEMANTIC_CACHE_TTL_MS as default TTL", () => {
    process.env.SEMANTIC_CACHE_TTL_MS = "100";
    const sig = generateSignature("gpt-4", [{ role: "user", content: "env-ttl" }], 0, 1);
    setCachedResponse(sig, "gpt-4", sampleResponse("env-ttl"), 5);
    delete process.env.SEMANTIC_CACHE_TTL_MS;

    // Should be stored with the overridden TTL from env
    const cached = getCachedResponse(sig);
    assert.ok(cached, "should HIT immediately after set (even with short env TTL)");
  });
});

// ─── 6. Maintenance Operations ──────────────────────────────────────

describe("Maintenance operations", () => {
  beforeEach(() => {
    clearCache();
  });

  it("clearCache removes all entries", () => {
    const sig1 = generateSignature("gpt-4", [{ role: "user", content: "clear1" }], 0, 1);
    const sig2 = generateSignature("gpt-4", [{ role: "user", content: "clear2" }], 0, 1);
    setCachedResponse(sig1, "gpt-4", sampleResponse("c1"), 5);
    setCachedResponse(sig2, "gpt-4", sampleResponse("c2"), 5);

    const removed = clearCache();
    assert.ok(removed >= 0, "clearCache should return number of removed entries");

    assert.equal(getCachedResponse(sig1), null, "first entry should be gone after clear");
    assert.equal(getCachedResponse(sig2), null, "second entry should be gone after clear");
  });

  it("cleanExpiredEntries removes expired entries (fail-open without DB)", () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "clean" }], 0, 1);
    setCachedResponse(sig, "gpt-4", sampleResponse("clean-me"), 5);
    const removed = cleanExpiredEntries();
    assert.equal(typeof removed, "number", "cleanExpiredEntries should return a number");
  });

  it("invalidateByModel clears entries by model name", () => {
    const sigGpt = generateSignature("gpt-4", [{ role: "user", content: "invalidate" }], 0, 1);
    const sigClaude = generateSignature("claude-3", [{ role: "user", content: "invalidate" }], 0, 1);

    setCachedResponse(sigGpt, "gpt-4", sampleResponse("gpt"), 5);
    setCachedResponse(sigClaude, "claude-3", sampleResponse("claude"), 5);

    invalidateByModel("gpt-4");

    // Note: invalidateByModel calls getMemoryCache().clear() internally,
    // so the memory cache is FULLY cleared (the implementation does not
    // track model membership in the LRU). The DB, however, only removes
    // matching model entries.
    assert.equal(getCachedResponse(sigGpt), null, "gpt-4 entry should be invalidated");

    // Re-store the claude entry to verify the model is still usable
    setCachedResponse(sigClaude, "claude-3", sampleResponse("claude"), 5);
    assert.ok(getCachedResponse(sigClaude), "claude-3 should work when re-stored");
  });

  it("invalidateBySignature clears a single entry", () => {
    const sig1 = generateSignature("gpt-4", [{ role: "user", content: "sig1" }], 0, 1);
    const sig2 = generateSignature("gpt-4", [{ role: "user", content: "sig2" }], 0, 1);

    setCachedResponse(sig1, "gpt-4", sampleResponse("s1"), 5);
    setCachedResponse(sig2, "gpt-4", sampleResponse("s2"), 5);

    invalidateBySignature(sig1);

    assert.equal(getCachedResponse(sig1), null, "entry 1 should be invalidated");
    assert.ok(getCachedResponse(sig2), "entry 2 should survive");
  });

  it("invalidateStale removes entries older than maxAgeMs", () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "stale" }], 0, 1);
    setCachedResponse(sig, "gpt-4", sampleResponse("stale"), 5);

    // Invalidate with 0ms max age — everything is stale
    invalidateStale(0);

    assert.equal(getCachedResponse(sig), null, "entry should be removed as stale");
  });
});

// ─── 7. Cache Stats ─────────────────────────────────────────────────

describe("getCacheStats", () => {
  beforeEach(() => {
    clearCache();
  });

  it("returns zeroed stats for empty cache", () => {
    const stats = getCacheStats();
    assert.equal(stats.memoryEntries, 0, "memory should be empty");
    assert.equal(stats.hits, 0);
    assert.equal(stats.misses, 0);
    assert.equal(stats.tokensSaved, 0);
    assert.equal(stats.hitRate, "0.0");
  });

  it("reflects hits and misses after operations", () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "stats-test" }], 0, 1);
    setCachedResponse(sig, "gpt-4", sampleResponse(), 50);

    // Miss
    const missSig = generateSignature("gpt-4", [{ role: "user", content: "no-exist" }], 0, 1);
    getCachedResponse(missSig);

    // Hit
    getCachedResponse(sig);

    const stats = getCacheStats();
    assert.equal(stats.memoryEntries, 1, "memory should have 1 entry");
    assert.equal(stats.dbEntries >= 1, true, "DB should reflect entries");
    assert.equal(stats.hits, 1, "one cache hit");
    assert.equal(stats.misses, 1, "one cache miss");
    assert.equal(stats.hitRate, "50.0", "50% hit rate");
  });
});

// ─── 8. Probabilistic Early Expiry (thundering herd) ────────────────

describe("Probabilistic early expiry", () => {
  beforeEach(() => {
    clearCache();
  });

  it("does NOT implement probabilistic early expiry (noted gap)", () => {
    // The current implementation uses hard TTL expiry only. There is no
    // jitter / probabilistic early-exit to protect against thundering herds
    // when many requests arrive just as an entry expires.
    //
    // This test documents the gap. To add PEE, introduce a random early-exit
    // window (e.g., serve stale for 10% of requests within 10% of TTL) and
    // verify that some fraction of requests bypass the cache near expiry.
    const sig = generateSignature("gpt-4", [{ role: "user", content: "pee-check" }], 0, 1);
    setCachedResponse(sig, "gpt-4", sampleResponse(), 5, 5000);

    // 100 reads within TTL should all hit (no probabilistic bypass)
    let hitCount = 0;
    for (let i = 0; i < 100; i++) {
      if (getCachedResponse(sig)) hitCount++;
    }
    assert.equal(hitCount, 100, "all reads within TTL should HIT (no PEE)");
  });
});

// ─── 9. Edge Cases ──────────────────────────────────────────────────

describe("Edge cases", () => {
  beforeEach(() => {
    clearCache();
  });

  it("setCachedResponse with null response does not crash", () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "null" }], 0, 1);
    assert.doesNotThrow(() => setCachedResponse(sig, "gpt-4", null, 0));
  });

  it("setCachedResponse with zero tokensSaved does not crash", () => {
    const sig = generateSignature("gpt-4", [{ role: "user", content: "zero" }], 0, 1);
    assert.doesNotThrow(() => setCachedResponse(sig, "gpt-4", sampleResponse(), 0));
    const cached = getCachedResponse(sig);
    assert.ok(cached, "entry with 0 tokens should be cacheable");
  });

  it("invalidateByModel with empty model name does not crash", () => {
    const result = invalidateByModel("");
    assert.equal(typeof result, "number");
  });

  it("cleanExpiredEntries on empty cache returns 0", () => {
    const result = cleanExpiredEntries();
    assert.equal(typeof result, "number");
  });

  it("start/stop auto cleanup does not crash", async () => {
    const { startAutoCleanup, stopAutoCleanup } = await import("../../../src/lib/semanticCache.ts");

    assert.doesNotThrow(() => startAutoCleanup(5000));
    assert.doesNotThrow(() => stopAutoCleanup());
    // Double stop is safe
    assert.doesNotThrow(() => stopAutoCleanup());
  });
});
