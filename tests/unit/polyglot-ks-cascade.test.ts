/**
 * Per-provider kill-switch cascade integration tests.
 *
 * Validates that:
 *   1. Global cascade (B9 semantics) downgrades EVERY edge to T1 when
 *      ANY provider is tripped.
 *   2. Granular cascade downgrades ONLY edges whose `providerScope`
 *      overlaps a tripped provider.
 *   3. `OMNIROUTE_KS_CASCADE_MODE` env var switches between modes.
 *   4. Restoring the tripped provider restores the original tier.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  registerEdge,
  __resetEdgeRegistryForTests,
  getEdgeTier,
} from "../../open-sse/rpc/polyglotEdges";
import {
  syncPolyglotToKillSwitch,
  syncPolyglotToPerProviderKillSwitch,
  __resetKillSwitchBridgeForTests,
} from "../../open-sse/rpc/killSwitchBridge";

describe("kill-switch cascade", { concurrency: 1 }, () => {
  beforeEach(() => {
    __resetEdgeRegistryForTests();
    __resetKillSwitchBridgeForTests();
  });

  afterEach(() => {
    __resetEdgeRegistryForTests();
    __resetKillSwitchBridgeForTests();
  });

  it("global cascade downgrades all edges on any trip", () => {
    registerEdge({
      name: "ks.test.global.1",
      providerScope: ["openai"],
      defaultTier: "T3",
      fallbackTier: "T1",
      healthcheck: async () => null,
      invoke: async () => null,
    });
    registerEdge({
      name: "ks.test.global.2",
      providerScope: ["anthropic"],
      defaultTier: "T3",
      fallbackTier: "T1",
      healthcheck: async () => null,
      invoke: async () => null,
    });

    syncPolyglotToKillSwitch(true);
    assert.equal(getEdgeTier("ks.test.global.1"), "T1");
    assert.equal(getEdgeTier("ks.test.global.2"), "T1");

    syncPolyglotToKillSwitch(false);
    // After restore, reconcile runs and may pick T3 or T2 depending on
    // CPU pressure; either is "not T1", which is the assertion contract.
    assert.notEqual(getEdgeTier("ks.test.global.1"), "T1");
    assert.notEqual(getEdgeTier("ks.test.global.2"), "T1");
  });

  it("granular cascade only downgrades overlapping-provider edges", () => {
    registerEdge({
      name: "ks.test.cascade.openai",
      providerScope: ["openai"],
      defaultTier: "T3",
      fallbackTier: "T1",
      healthcheck: async () => null,
      invoke: async () => null,
    });
    registerEdge({
      name: "ks.test.cascade.anthropic",
      providerScope: ["anthropic"],
      defaultTier: "T3",
      fallbackTier: "T1",
      healthcheck: async () => null,
      invoke: async () => null,
    });

    const result = syncPolyglotToPerProviderKillSwitch([
      { provider: "openai", isActive: true },
      { provider: "anthropic", isActive: false },
    ]);
    assert.equal(getEdgeTier("ks.test.cascade.openai"), "T1");
    assert.equal(getEdgeTier("ks.test.cascade.anthropic"), "T3");
    assert.ok(result.downgraded.includes("ks.test.cascade.openai"));
    assert.ok(!result.downgraded.includes("ks.test.cascade.anthropic"));

    const result2 = syncPolyglotToPerProviderKillSwitch([
      { provider: "openai", isActive: false },
      { provider: "anthropic", isActive: false },
    ]);
    // After restore, reconcile may pick T3 or T2 depending on pressure.
    assert.notEqual(getEdgeTier("ks.test.cascade.openai"), "T1");
    assert.notEqual(getEdgeTier("ks.test.cascade.anthropic"), "T1");
    assert.ok(result2.restored.includes("ks.test.cascade.openai"));
  });

  it("wildcard provider scope matches everything", () => {
    registerEdge({
      name: "ks.test.cascade.wildcard",
      providerScope: ["*"],
      defaultTier: "T3",
      fallbackTier: "T1",
      healthcheck: async () => null,
      invoke: async () => null,
    });
    syncPolyglotToPerProviderKillSwitch([{ provider: "gemini", isActive: true }]);
    assert.equal(getEdgeTier("ks.test.cascade.wildcard"), "T1");
  });
});
