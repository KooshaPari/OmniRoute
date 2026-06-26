/**
 * Unit tests for cache key normalisation — PR-036
 *
 * @module tests/unit/cache/normalise.test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCacheKey, keyPrefix, keyHash } from "../../../src/lib/cache/normalise.ts";

describe("Cache Key Normalisation", () => {
  const defaultMessages = [{ role: "user", content: "Hello, world!" }];

  // ── Determinism ─────────────────────────────────

  it("generates identical keys for identical params", () => {
    const key1 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, temperature: 0, top_p: 1 });
    const key2 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, temperature: 0, top_p: 1 });
    assert.equal(key1, key2);
  });

  it("generates different keys for different models", () => {
    const key1 = generateCacheKey({ model: "gpt-4", messages: defaultMessages });
    const key2 = generateCacheKey({ model: "claude-3.5", messages: defaultMessages });
    assert.notEqual(key1, key2);
  });

  it("generates different keys for different temperatures", () => {
    const key1 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, temperature: 0 });
    const key2 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, temperature: 0.7 });
    assert.notEqual(key1, key2);
  });

  it("generates different keys for different messages", () => {
    const key1 = generateCacheKey({ model: "gpt-4", messages: [{ role: "user", content: "hello" }] });
    const key2 = generateCacheKey({ model: "gpt-4", messages: [{ role: "user", content: "goodbye" }] });
    assert.notEqual(key1, key2);
  });

  it("generates identical keys for identical content regardless of property order", () => {
    const msg1 = [{ role: "user", content: "test", extra: "x" }];
    const msg2 = [{ extra: "x", content: "test", role: "user" }];
    const key1 = generateCacheKey({ model: "gpt-4", messages: msg1 });
    const key2 = generateCacheKey({ model: "gpt-4", messages: msg2 });
    assert.equal(key1, key2);
  });

  // ── Key format / structure ───────────────────────

  it("includes provider prefix in the key", () => {
    const key = generateCacheKey({ model: "gpt-4", messages: defaultMessages, provider: "openai" });
    assert.ok(key.startsWith("openai."), `key "${key}" should start with "openai."`);
  });

  it("includes tenant prefix in the key", () => {
    const key = generateCacheKey({ model: "gpt-4", messages: defaultMessages, provider: "openai", tenant: "tenant-abc" });
    assert.ok(key.startsWith("openai.tenant-abc."), `key "${key}" should start with "openai.tenant-abc."`);
  });

  it("uses placeholder underscore for missing provider", () => {
    const key = generateCacheKey({ model: "gpt-4", messages: defaultMessages });
    assert.ok(key.startsWith("_."), `key "${key}" should start with "._"`);
  });

  it("generates 64-char hex hash after prefix", () => {
    const key = generateCacheKey({ model: "gpt-4", messages: defaultMessages });
    const hash = key.slice(key.lastIndexOf(".") + 1);
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(hash), `hash "${hash}" should be hex`);
  });

  it("generates different keys for different providers with same content", () => {
    const key1 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, provider: "openai" });
    const key2 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, provider: "anthropic" });
    assert.notEqual(key1, key2);
  });

  it("generates different keys for different tenants with same content", () => {
    const key1 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, tenant: "alice" });
    const key2 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, tenant: "bob" });
    assert.notEqual(key1, key2);
  });

  // ── Edge cases ──────────────────────────────────

  it("handles empty messages array", () => {
    const key = generateCacheKey({ model: "gpt-4", messages: [] });
    assert.ok(key.length > 50);
  });

  it("handles nullish temperature and top_p", () => {
    const key1 = generateCacheKey({ model: "gpt-4", messages: defaultMessages });
    const key2 = generateCacheKey({ model: "gpt-4", messages: defaultMessages, temperature: 0, top_p: 1 });
    assert.equal(key1, key2);
  });

  it("handles multi-turn conversations", () => {
    const msgs = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "What is the weather?" },
    ];
    const key = generateCacheKey({ model: "gpt-4", messages: msgs });
    assert.ok(key.length > 50);
  });

  it("handles message with tool calls", () => {
    const msgs = [
      { role: "user", content: "Calculate" },
      { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "calc", arguments: "{}" } }] },
    ];
    const key = generateCacheKey({ model: "gpt-4", messages: msgs });
    assert.ok(key.length > 50);
  });

  it("handles message with vision content (array of content parts)", () => {
    const msgs = [
      { role: "user", content: [{ type: "text", text: "What's in this image?" }, { type: "image_url", image_url: { url: "data:image/png;base64,iVBOR..." } }] },
    ];
    const key = generateCacheKey({ model: "gpt-4", messages: msgs });
    assert.ok(key.length > 50);
  });

  // ── keyPrefix / keyHash helpers ──────────────────

  it("keyPrefix returns the prefix portion", () => {
    const key = generateCacheKey({ model: "gpt-4", messages: defaultMessages, provider: "p", tenant: "t" });
    const prefix = keyPrefix(key);
    assert.ok(key.startsWith(prefix), `prefix "${prefix}" should be a prefix of "${key}"`);
  });

  it("keyHash returns the hex hash portion", () => {
    const key = generateCacheKey({ model: "gpt-4", messages: defaultMessages });
    const hash = keyHash(key);
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(hash));
  });

  it("keyHash works on bare hash strings", () => {
    const bare = "a".repeat(64);
    assert.equal(keyHash(bare), bare);
  });
});
