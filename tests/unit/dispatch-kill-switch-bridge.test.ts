/**
 * Tests for the kill-switch bridge (ADR-032 § "Wiring").
 *
 * Covers:
 *   - syncDispatchToKillSwitch(true) flips every edge to T1.
 *   - syncDispatchToKillSwitch(false) restores each edge to its default tier.
 *   - The bridge is idempotent: a no-change state emits no work.
 */

import test from "node:test";
import assert from "node:assert/strict";

const { registerEdge, getEdgeTier, __resetEdgeRegistryForTests } = await import(
  "../../open-sse/rpc/dispatchEdges.ts"
);
const { syncDispatchToKillSwitch, __resetKillSwitchBridgeForTests } = await import(
  "../../open-sse/rpc/killSwitchBridge.ts"
);

function reg(name: string, tier: "T1" | "T2" | "T3") {
  return registerEdge({
    name,
    defaultTier: tier,
    http: { path: `/api/internal/edges/${name}`, timeoutMs: 100 },
    uds: { method: name, timeoutMs: 50 },
    ffi: { crate: `crate_${name}`, symbol: `sym_${name}`, timeoutMs: 10 },
  });
}

test.beforeEach(() => {
  __resetEdgeRegistryForTests();
  __resetKillSwitchBridgeForTests();
});

// ─── K1: kill-switch ON → every edge T1 ──────────────────────────────────

test("syncDispatchToKillSwitch(true) flips every edge to T1", () => {
  reg("ks.test1", "T2");
  reg("ks.test2", "T3");

  syncDispatchToKillSwitch(true);

  assert.equal(getEdgeTier("ks.test1"), "T1");
  assert.equal(getEdgeTier("ks.test2"), "T1");
});

// ─── K2: kill-switch OFF → restore defaults ───────────────────────────────

test("syncDispatchToKillSwitch(false) restores each edge to its default tier", () => {
  // Use T2-default so the post-restore reconcile step doesn't downgrade
  // T3 → T2 via real cpuPressure on a busy CI box.
  reg("ks.test3", "T2");
  reg("ks.test4", "T2");

  syncDispatchToKillSwitch(true);
  assert.equal(getEdgeTier("ks.test3"), "T1");
  assert.equal(getEdgeTier("ks.test4"), "T1");

  syncDispatchToKillSwitch(false);
  assert.equal(getEdgeTier("ks.test3"), "T2");
  assert.equal(getEdgeTier("ks.test4"), "T2");
});

// ─── K3: idempotent (no-op when state hasn't changed) ─────────────────────

test("syncDispatchToKillSwitch(true) twice is idempotent", () => {
  reg("ks.test5", "T3");

  syncDispatchToKillSwitch(true);
  const tierAfterFirst = getEdgeTier("ks.test5");
  syncDispatchToKillSwitch(true);
  const tierAfterSecond = getEdgeTier("ks.test5");
  assert.equal(tierAfterFirst, tierAfterSecond);
  assert.equal(tierAfterFirst, "T1");
});

test("syncDispatchToKillSwitch(false) when never activated is a no-op", () => {
  reg("ks.test6", "T3");
  syncDispatchToKillSwitch(false);
  // The edge should keep its default T3.
  assert.equal(getEdgeTier("ks.test6"), "T3");
});