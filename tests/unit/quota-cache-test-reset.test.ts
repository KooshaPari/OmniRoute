import assert from "node:assert/strict";
import test from "node:test";

const quotaCache = await import("../../src/domain/quotaCache.ts");

test("__clearForTests resets every quota cache global state field", () => {
  quotaCache.__clearForTests();
  try {
    quotaCache.setQuotaCache("quota-reset-connection", "codex", {
      session: { remainingPercentage: 0, resetAt: null },
    });
    quotaCache.startBackgroundRefresh();

    const state = globalThis.__omnirouteQuotaCacheState!;
    const generation = state.generation;
    state.refreshingSet.add("quota-reset-connection");

    quotaCache.__clearForTests();

    assert.equal(state.cache.size, 0);
    assert.equal(state.refreshingSet.size, 0);
    assert.equal(state.refreshTimer, null);
    assert.equal(state.tickRunning, false);
    assert.equal(state.generation, generation + 1);
  } finally {
    quotaCache.__clearForTests();
  }
});
