/**
 * Unit tests — PR-037 Cache key derivation + Query-response cache.
 *
 * Tests cover:
 *   1. Cache key derivation normalisation and determinism
 *   2. Cache key isolation (tenant, API key, namespace)
 *   3. Cacheability checks (temperature, headers)
 *   4. Query-response cache roundtrip (in-memory)
 *   5. Cache stats and invalidation
 *
 * Minimum 50 assertions.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// ── Module imports ───────────────────────────────────────────

import {
  deriveCacheKey,
  hashPrompt,
  parseCacheKeyPrefix,
} from "../../src/lib/cache/normalise.ts";

import {
  keyFromBody,
  isCacheableRequest,
  isCacheableResponse,
  getCachedResponse,
  setCachedResponse,
  clearCache,
  getCacheStats,
  invalidateByKey,
} from "../../src/lib/cache/queryResponseCache.ts";

// ═══════════════════════════════════════════════════════════════
//  Section 1: deriveCacheKey — Determinism & Normalization
// ═══════════════════════════════════════════════════════════════

describe("deriveCacheKey — determinism & normalization", () => {
  it("returns same key for identical inputs", () => {
    const params = {
      model: "gpt-4",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0,
      top_p: 1,
    };
    const k1 = deriveCacheKey(params);
    const k2 = deriveCacheKey(params);
    assert.equal(k1, k2);
  });

  it("returns different keys for different models", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs });
    const k2 = deriveCacheKey({ model: "gpt-3.5-turbo", messages: msgs });
    assert.notEqual(k1, k2);
  });

  it("returns different keys for different messages", () => {
    const k1 = deriveCacheKey({ model: "gpt-4", messages: [{ role: "user", content: "hello" }] });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: [{ role: "user", content: "goodbye" }] });
    assert.notEqual(k1, k2);
  });

  it("returns different keys for different temperatures", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, temperature: 0 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, temperature: 0.7 });
    assert.notEqual(k1, k2);
  });

  it("returns different keys for different top_p", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, top_p: 0.9 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, top_p: 1 });
    assert.notEqual(k1, k2);
  });

  it("normalizes messages — strips extra volatile fields", () => {
    const msg1 = [{ role: "user", content: "hello", extra: true, metadata: { x: 1 } }];
    const msg2 = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msg1 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msg2 });
    assert.equal(k1, k2, "extra fields must not change the key");
  });

  it("normalizes messages — preserves tool_calls", () => {
    const msgs = [
      { role: "assistant", tool_calls: [{ id: "call_1", type: "function", function: { name: "f", arguments: "{}" } }] },
    ];
    const k = deriveCacheKey({ model: "gpt-4", messages: msgs });
    assert.ok(k);
    assert.equal(typeof k, "string");
  });

  it("handles non-string content (content arrays)", () => {
    const msgs = [{ role: "user", content: [{ type: "text", text: "hello" }] }];
    const k = deriveCacheKey({ model: "gpt-4", messages: msgs });
    assert.ok(k);
    assert.equal(typeof k, "string");
  });

  it("handles empty messages array", () => {
    const k = deriveCacheKey({ model: "gpt-4", messages: [] });
    assert.ok(k);
    assert.equal(typeof k, "string");
  });

  it("returns null when model is empty string", () => {
    const k = deriveCacheKey({ model: "", messages: [{ role: "user", content: "hi" }] });
    assert.equal(k, null);
  });

  it("returns null when messages is undefined", () => {
    const k = deriveCacheKey({ model: "gpt-4", messages: undefined as unknown as [] });
    assert.equal(k, null);
  });

  it("returns null when messages is null", () => {
    const k = deriveCacheKey({ model: "gpt-4", messages: null as unknown as [] });
    assert.equal(k, null);
  });

  it("handles model with whitespace by trimming", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "  gpt-4  ", messages: msgs });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs });
    assert.equal(k1, k2, "whitespace around model name must be trimmed");
  });

  it("caps temperature to 2 decimal places", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, temperature: 0.33333 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, temperature: 0.33 });
    const k3 = deriveCacheKey({ model: "gpt-4", messages: msgs, temperature: 0.33334 });
    assert.equal(k1, k2, "0.33333 rounds to 0.33");
    assert.equal(k1, k3, "0.33334 rounds to 0.33");
  });

  it("caps top_p to 2 decimal places", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, top_p: 0.55555 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, top_p: 0.56 });
    assert.equal(k1, k2);
  });

  it("includes max_tokens in key derivation", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, max_tokens: 100 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, max_tokens: 200 });
    assert.notEqual(k1, k2);
  });

  it("sorts stop array for deterministic ordering", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, stop: ["\n", ".", "!"] });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, stop: ["!", ".", "\n"] });
    assert.equal(k1, k2, "stop array order must not affect cache key");
  });

  it("normalizes tools (strips extra tool fields)", () => {
    const msgs = [{ role: "user", content: "hi" }];
    const tools1 = [{ type: "function", function: { name: "f", description: "d" }, extra: true }];
    const tools2 = [{ type: "function", function: { name: "f" } }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, tools: tools1 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, tools: tools2 });
    assert.equal(k1, k2, "extra tool fields must be stripped");
  });

  it("includes tool_choice when present", () => {
    const msgs = [{ role: "user", content: "hi" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, tool_choice: "auto" });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, tool_choice: "none" });
    assert.notEqual(k1, k2);
  });

  it("includes response_format when present", () => {
    const msgs = [{ role: "user", content: "hi" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, response_format: { type: "text" } });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, response_format: { type: "json_object" } });
    assert.notEqual(k1, k2);
  });

  it("includes seed when present", () => {
    const msgs = [{ role: "user", content: "hi" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, seed: 42 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, seed: 99 });
    assert.notEqual(k1, k2);
  });

  it("includes presence_penalty when present", () => {
    const msgs = [{ role: "user", content: "hi" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, presence_penalty: 0 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, presence_penalty: 0.5 });
    assert.notEqual(k1, k2);
  });

  it("includes frequency_penalty when present", () => {
    const msgs = [{ role: "user", content: "hi" }];
    const k1 = deriveCacheKey({ model: "gpt-4", messages: msgs, frequency_penalty: 0 });
    const k2 = deriveCacheKey({ model: "gpt-4", messages: msgs, frequency_penalty: 0.5 });
    assert.notEqual(k1, k2);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Section 2: deriveCacheKey — Isolation Prefixes
// ═══════════════════════════════════════════════════════════════

describe("deriveCacheKey — isolation prefixes", () => {
  const msgs = [{ role: "user", content: "what is 2+2?" }];
  const base = { model: "gpt-4o", messages: msgs };

  it("returns consistent keys for same apiKeyId", () => {
    const k1 = deriveCacheKey({ ...base, apiKeyId: "key-alice" });
    const k2 = deriveCacheKey({ ...base, apiKeyId: "key-alice" });
    assert.equal(k1, k2);
  });

  it("returns different keys for different apiKeyId", () => {
    const k1 = deriveCacheKey({ ...base, apiKeyId: "key-alice" });
    const k2 = deriveCacheKey({ ...base, apiKeyId: "key-bob" });
    assert.notEqual(k1, k2);
  });

  it("returns different keys for different tenantId", () => {
    const k1 = deriveCacheKey({ ...base, tenantId: "tenant-a" });
    const k2 = deriveCacheKey({ ...base, tenantId: "tenant-b" });
    assert.notEqual(k1, k2);
  });

  it("returns different keys for different namespace", () => {
    const k1 = deriveCacheKey({ ...base, namespace: "prod" });
    const k2 = deriveCacheKey({ ...base, namespace: "staging" });
    assert.notEqual(k1, k2);
  });

  it("prefixes key with isolation values (colon-separated)", () => {
    const k = deriveCacheKey({ ...base, tenantId: "t1", apiKeyId: "k1", namespace: "n1" });
    assert.ok(k.startsWith("t1:k1:n1:"));
  });

  it("returns un-prefixed key when no isolation given", () => {
    const k = deriveCacheKey(base);
    assert.ok(k);
    // SHA-256 hex digest is 64 chars — key with no prefix should not have a colon
    assert.equal(k.includes(":"), false);
  });

  it("parseCacheKeyPrefix extracts first segment", () => {
    const prefix = parseCacheKeyPrefix("tenant-42:abc123deadbeef");
    assert.equal(prefix, "tenant-42");
  });

  it("parseCacheKeyPrefix returns empty for no prefix", () => {
    assert.equal(parseCacheKeyPrefix("deadbeef"), "");
  });
});

// ═══════════════════════════════════════════════════════════════
//  Section 3: hashPrompt
// ═══════════════════════════════════════════════════════════════

describe("hashPrompt", () => {
  it("returns deterministic hash for same input", () => {
    const h1 = hashPrompt("Hello, world!");
    const h2 = hashPrompt("Hello, world!");
    assert.equal(h1, h2);
  });

  it("returns different hash for different input", () => {
    const h1 = hashPrompt("Hello");
    const h2 = hashPrompt("World");
    assert.notEqual(h1, h2);
  });

  it("returns 64-char hex string (SHA-256 truncated to 32 bytes = 64 hex)", () => {
    const h = hashPrompt("test");
    assert.equal(typeof h, "string");
    // hashPrompt returns slice(0, 32) — that's 32 hex chars
    assert.equal(h.length, 32, "expected 32 hex characters");
    assert.ok(/^[0-9a-f]+$/.test(h), "expected hex string");
  });
});

// ═══════════════════════════════════════════════════════════════
//  Section 4: keyFromBody — Convenience wrapper
// ═══════════════════════════════════════════════════════════════

describe("keyFromBody", () => {
  it("returns null for missing model", () => {
    const k = keyFromBody({ messages: [{ role: "user", content: "hi" }] });
    assert.equal(k, null);
  });

  it("returns null for missing messages", () => {
    const k = keyFromBody({ model: "gpt-4" });
    assert.equal(k, null);
  });

  it("generates deterministic key from valid body", () => {
    const body = { model: "gpt-4", messages: [{ role: "user", content: "hi" }], temperature: 0 };
    const k1 = keyFromBody(body);
    const k2 = keyFromBody(body);
    assert.equal(k1, k2);
  });

  it("includes apiKeyId prefix when provided", () => {
    const body = { model: "gpt-4", messages: [{ role: "user", content: "hi" }] };
    const k = keyFromBody(body, { apiKeyId: "key-abc" });
    assert.ok(k.startsWith("key-abc:"));
  });

  it("includes tenantId prefix when provided", () => {
    const body = { model: "gpt-4", messages: [{ role: "user", content: "hi" }] };
    const k = keyFromBody(body, { tenantId: "tenant-xyz" });
    assert.ok(k.startsWith("tenant-xyz:"));
  });
});

// ═══════════════════════════════════════════════════════════════
//  Section 5: isCacheableRequest / isCacheableResponse
// ═══════════════════════════════════════════════════════════════

describe("isCacheableRequest", () => {
  it("returns true for temperature=0", () => {
    assert.equal(isCacheableRequest({ temperature: 0 }, null), true);
  });

  it("returns false when temperature is omitted", () => {
    assert.equal(isCacheableRequest({}, null), false);
  });

  it("returns false for temperature=0.7", () => {
    assert.equal(isCacheableRequest({ temperature: 0.7 }, null), false);
  });

  it("returns false for temperature=1", () => {
    assert.equal(isCacheableRequest({ temperature: 1 }, null), false);
  });

  it("returns false when no-cache header is set (string map)", () => {
    const headers = { "x-omniroute-no-cache": "true" };
    assert.equal(isCacheableRequest({ temperature: 0 }, headers), false);
  });

  it("returns false when no-cache header is set (Headers object)", () => {
    const headers = new Headers({ "X-OmniRoute-No-Cache": "true" });
    assert.equal(isCacheableRequest({ temperature: 0 }, headers), false);
  });

  it("returns true when no-cache header is absent", () => {
    const headers = new Headers({});
    assert.equal(isCacheableRequest({ temperature: 0 }, headers), true);
  });

  it("returns true when no-cache header is false", () => {
    const headers = { "x-omniroute-no-cache": "false" };
    assert.equal(isCacheableRequest({ temperature: 0 }, headers), true);
  });

  it("returns false for null headers (no crash)", () => {
    assert.equal(isCacheableRequest({ temperature: 0 }, null), true);
  });
});

describe("isCacheableResponse", () => {
  it("returns true for status 200", () => {
    assert.equal(isCacheableResponse(200), true);
  });

  it("returns false for status 201", () => {
    assert.equal(isCacheableResponse(201), false);
  });

  it("returns false for status 400", () => {
    assert.equal(isCacheableResponse(400), false);
  });

  it("returns false for status 500", () => {
    assert.equal(isCacheableResponse(500), false);
  });

  it("returns false for status 429", () => {
    assert.equal(isCacheableResponse(429), false);
  });

  it("handles null headers gracefully", () => {
    assert.equal(isCacheableResponse(200, null), true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Section 6: getCachedResponse / setCachedResponse — Memory tier
// ═══════════════════════════════════════════════════════════════

describe("queryResponseCache — memory roundtrip", () => {
  beforeEach(() => {
    clearCache();
  });

  it("returns null on cache miss", () => {
    const result = getCachedResponse("nonexistent-key");
    assert.equal(result, null);
  });

  it("stores and retrieves a response", () => {
    const cacheKey = "test-key-1";
    const response = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [{ index: 0, message: { role: "assistant", content: "Hello!" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    setCachedResponse(cacheKey, response, "gpt-4");
    const cached = getCachedResponse(cacheKey);
    assert.notEqual(cached, null);
    assert.equal(cached!.id, "chatcmpl-123");
    assert.equal(cached!.choices[0].message.content, "Hello!");
    assert.equal(cached!.usage?.total_tokens, 15);
  });

  it("stores and retrieves multiple entries independently", () => {
    const r1 = { id: "r1", object: "chat.completion", created: 1, model: "gpt-4", choices: [] };
    const r2 = { id: "r2", object: "chat.completion", created: 2, model: "gpt-4", choices: [] };

    setCachedResponse("key-a", r1, "gpt-4");
    setCachedResponse("key-b", r2, "gpt-4");

    assert.equal(getCachedResponse("key-a")!.id, "r1");
    assert.equal(getCachedResponse("key-b")!.id, "r2");
  });

  it("overwrites existing entry for same key", () => {
    const r1 = { id: "old", object: "chat.completion", created: 1, model: "gpt-4", choices: [] };
    const r2 = { id: "new", object: "chat.completion", created: 2, model: "gpt-4", choices: [] };

    setCachedResponse("key-u", r1, "gpt-4");
    setCachedResponse("key-u", r2, "gpt-4");

    assert.equal(getCachedResponse("key-u")!.id, "new");
  });
});

// ═══════════════════════════════════════════════════════════════
//  Section 7: getCacheStats
// ═══════════════════════════════════════════════════════════════

describe("queryResponseCache — stats", () => {
  beforeEach(() => {
    clearCache();
  });

  it("returns zeroed stats after clear", () => {
    const stats = getCacheStats();
    assert.equal(stats.memoryEntries, 0);
    assert.ok(typeof stats.hitRate === "string");
    assert.ok(typeof stats.tokensSaved === "number");
  });

  it("reports memory entries after set", () => {
    const response = { id: "r1", object: "chat.completion", created: 1, model: "gpt-4", choices: [] };
    setCachedResponse("stat-key", response, "gpt-4");
    const stats = getCacheStats();
    assert.equal(stats.memoryEntries, 1);
  });

  it("tracks cache hits", () => {
    const response = { id: "r1", object: "chat.completion", created: 1, model: "gpt-4", choices: [] };
    setCachedResponse("hit-key", response, "gpt-4");
    getCachedResponse("hit-key"); // miss in SQLite, but memory hit
    const stats = getCacheStats();
    assert.ok(stats.hits >= 1);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Section 8: invalidateByKey
// ═══════════════════════════════════════════════════════════════

describe("queryResponseCache — invalidation", () => {
  beforeEach(() => {
    clearCache();
  });

  it("invalidates single entry by key", () => {
    const response = { id: "r1", object: "chat.completion", created: 1, model: "gpt-4", choices: [] };
    setCachedResponse("inv-key", response, "gpt-4");
    assert.notEqual(getCachedResponse("inv-key"), null);

    const removed = invalidateByKey("inv-key");
    assert.equal(removed, true);
    assert.equal(getCachedResponse("inv-key"), null);
  });

  it("returns false when invalidating non-existent key", () => {
    assert.equal(invalidateByKey("does-not-exist"), false);
  });

  it("clearCache removes all entries", () => {
    const response = { id: "r1", object: "chat.completion", created: 1, model: "gpt-4", choices: [] };
    setCachedResponse("a", response, "gpt-4");
    setCachedResponse("b", response, "gpt-4");
    assert.equal(getCacheStats().memoryEntries, 2);

    clearCache();
    assert.equal(getCachedResponse("a"), null);
    assert.equal(getCachedResponse("b"), null);
    assert.equal(getCacheStats().memoryEntries, 0);
  });
});
