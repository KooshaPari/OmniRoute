// @vitest-environment node
/**
 * Tests for LearnedLimitStore — debounced persistence, ring-buffer cap,
 * stale-entry filtering, hydrate/reset lifecycle.
 */

import { describe, it, beforeEach, afterEach, afterAll, beforeAll, expect } from "vitest";
;
import { LearnedLimitStore, MAX_LEARNED_LIMITS, STALE_LIMIT_MS } from "../../../open-sse/services/learnedLimitStore.ts";

describe("LearnedLimitStore", () => {
  let store: LearnedLimitStore;

  beforeEach(() => {
    store = new LearnedLimitStore({ debounceMs: 10, staleMs: 1000 });
  });

  describe("record / getAll", () => {
    it("stores an entry under its key", () => {
      store.record("openai:conn1", { provider: "openai", connectionId: "conn1", limit: 60 });
      const all = store.getAll();
      expect(all["openai:conn1"]?.provider).toBe("openai");
      expect(all["openai:conn1"]?.connectionId).toBe("conn1");
      expect(all["openai:conn1"]?.limit).toBe(60);
      expect((all["openai:conn1"]?.lastUpdated ?? 0) > 0);
    });

    it("overwrites previous entry on duplicate key", () => {
      store.record("k", { provider: "p", connectionId: "c", limit: 10 });
      store.record("k", { provider: "p", connectionId: "c", limit: 20 });
      expect(store.getAll()["k"]?.limit).toBe(20);
    });

    it("isolates keys per (provider, connectionId, model)", () => {
      store.record("p:c:model-a", { provider: "p", connectionId: "c", limit: 100 }, "model-a");
      store.record("p:c:model-b", { provider: "p", connectionId: "c", limit: 200 }, "model-b");
      expect(store.getAll()["p:c:model-a"]?.limit).toBe(100);
      expect(store.getAll()["p:c:model-b"]?.limit).toBe(200);
    });

    it("returns a snapshot (mutations don't leak)", () => {
      store.record("k", { provider: "p", connectionId: "c", limit: 5 });
      const snap = store.getAll();
      delete snap["k"];
      expect(store.getAll()["k"], "snapshot must be a copy");
    });
  });

  describe("ring-buffer cap", () => {
    it("evicts oldest entries when over max", () => {
      const capped = new LearnedLimitStore({ maxEntries: 3, debounceMs: 9999 });
      capped.record("a", { provider: "p", connectionId: "c", limit: 1 });
      capped.record("b", { provider: "p", connectionId: "c", limit: 2 });
      capped.record("c", { provider: "p", connectionId: "c", limit: 3 });
      capped.record("d", { provider: "p", connectionId: "c", limit: 4 });
      const all = capped.getAll();
      expect(Object.keys(all).length).toBe(3);
      expect(!("a" in all), "oldest entry must be evicted");
      expect(all["d"]?.limit).toBe(4);
    });

    it("keeps cap at exactly maxEntries", () => {
      const capped = new LearnedLimitStore({ maxEntries: 5, debounceMs: 9999 });
      for (let i = 0; i < 10; i++) {
        capped.record(`k${i}`, { provider: "p", connectionId: "c", limit: i });
      }
      expect(Object.keys(capped.getAll()).length).toBe(5);
    });
  });

  describe("hydrate (load from persistence)", () => {
    it("restores entries from a JSON-string payload", () => {
      const json = JSON.stringify({
        x: { provider: "p", connectionId: "c", lastUpdated: Date.now(), limit: 60 },
      });
      const n = store.hydrate(json);
      expect(n).toBe(1);
      expect(store.getAll()["x"]?.limit).toBe(60);
    });

    it("returns 0 on null/empty payload", () => {
      expect(store.hydrate(null)).toBe(0);
      expect(store.hydrate(undefined)).toBe(0);
      expect(store.hydrate("")).toBe(0);
    });

    it("returns 0 on malformed JSON", () => {
      expect(store.hydrate("not-valid-json")).toBe(0);
    });

    it("drops entries older than staleMs", () => {
      const aged = new LearnedLimitStore({ debounceMs: 9999, staleMs: 100 });
      const json = JSON.stringify({
        fresh: { provider: "p", connectionId: "c", lastUpdated: Date.now(), limit: 1 },
        stale: { provider: "p", connectionId: "c", lastUpdated: Date.now() - 10_000, limit: 2 },
      });
      const n = aged.hydrate(json);
      expect(n).toBe(1);
      const all = aged.getAll();
      expect(all["fresh"]);
      expect(!all["stale"], "stale entry must be filtered");
    });

    it("drops negative / non-numeric numeric fields", () => {
      const json = JSON.stringify({
        x: {
          provider: "p",
          connectionId: "c",
          lastUpdated: Date.now(),
          limit: "not-a-number",
          remaining: -5,
          minTime: "abc",
        },
      });
      store.hydrate(json);
      const entry = store.getAll()["x"];
      expect(entry, "entry kept, invalid fields dropped");
      expect(entry?.limit).toBeUndefined();
      expect(entry?.remaining).toBeUndefined();
    });

    it("ignores non-object top-level payload", () => {
      const n = store.hydrate(JSON.stringify([1, 2, 3]));
      expect(n).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears all entries", () => {
      store.record("k", { provider: "p", connectionId: "c", limit: 5 });
      store.reset();
      expect(Object.keys(store.getAll()).length).toBe(0);
    });
  });

  describe("default constants", () => {
    it("exports MAX_LEARNED_LIMITS = 200", () => {
      expect(MAX_LEARNED_LIMITS).toBe(200);
    });

    it("exports STALE_LIMIT_MS = 24h", () => {
      expect(STALE_LIMIT_MS).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("persistence I/O", () => {
    it("flush() completes without throwing", async () => {
      store.record("k", { provider: "p", connectionId: "c", limit: 5 });
      await store.flush();
      // No assertion — just exercises the path
    });

    it("flush() on empty store completes", async () => {
      await store.flush();
    });
  });
});
