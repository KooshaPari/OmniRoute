import assert from "node:assert/strict";
import test from "node:test";

const quotaCache = await import("../../src/domain/quotaCache.ts");

test("__clearForTests resets every quota cache global state field", () => {
  quotaCache.__clearForTests();
  quotaCache.setQuotaCache("quota-reset-connection", "codex", {
    session: { remainingPercentage: 0, resetAt: null },
  });
  quotaCache.startBackgroundRefresh();

  const state = globalThis.__omnirouteQuotaCacheState!;
  state.refreshingSet.add("quota-reset-connection");
  state.tickRunning = true;

  quotaCache.__clearForTests();

  assert.equal(state.cache.size, 0);
  assert.equal(state.refreshingSet.size, 0);
  assert.equal(state.refreshTimer, null);
  assert.equal(state.tickRunning, false);
});
