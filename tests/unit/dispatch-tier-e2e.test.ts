import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  registerEdge,
  clearTierOverrides,
  setEdgeTier,
  getEdgeTier,
  __resetEdgeRegistryForTests,
} from "../../open-sse/rpc/dispatchEdges.ts";
import {
  resolveTier,
  __resetEdgeCacheForTests,
  activateKillSwitchDegradation,
  deactivateKillSwitchDegradation,
  isKillSwitchDegradationActive,
  __runOnceForTests,
} from "../../open-sse/rpc/tierResolver.ts";

function reg(name: string, tier: string) {
  registerEdge({ name, defaultTier: tier, providerScope: [] });
}

describe("dispatch-tier e2e: full resolution pipeline", () => {
  beforeEach(() => {
    __resetEdgeRegistryForTests();
    clearTierOverrides();
    __resetEdgeCacheForTests();
  });

  after(() => {
    __resetEdgeRegistryForTests();
    clearTierOverrides();
    __resetEdgeCacheForTests();
  });

  it("registers, resolves tiers correctly", () => {
    reg("e2e.scoring", "T3");
    reg("e2e.rateLimit", "T2");
    reg("e2e.config", "T1");
    assert.equal(resolveTier("scoring", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T3");
    assert.equal(resolveTier("rateLimit", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T2");
    assert.equal(resolveTier("config", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T1");
  });

  it("kill-switch forces all to T1", () => {
    reg("e2e.ks1", "T3");
    reg("e2e.ks2", "T2");
    activateKillSwitchDegradation();
    assert.equal(isKillSwitchDegradationActive(), true);
    assert.equal(resolveTier("ks1", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T1");
    assert.equal(resolveTier("ks2", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T1");
    deactivateKillSwitchDegradation();
    assert.equal(isKillSwitchDegradationActive(), false);
    assert.equal(resolveTier("ks1", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T3");
    assert.equal(resolveTier("ks2", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T2");
  });

  it("reconcile produces 0 changes when stable", () => {
    reg("e2e.stable", "T2");
    const c = __runOnceForTests({ cpuPressure: 0.1, killSwitchActive: false });
    assert.equal(c, 0);
  });

  it("reconcile produces changes on kill-switch", () => {
    reg("e2e.ks1", "T3");
    reg("e2e.ks2", "T2");
    const c = __runOnceForTests({ killSwitchActive: true });
    assert.equal(c, 2);
  });

  it("CPU pressure downgrades T3 to T2", () => {
    reg("e2e.cpu", "T3");
    const r = resolveTier("e2e.cpu", undefined, { cpuPressure: 0.9 });
    assert.equal(r.tier, "T2");
  });

  it("unknown edge returns T1", () => {
    const r = resolveTier("nonexistent.edge", undefined, { cpuPressure: 0, memPressure: 0 });
    assert.equal(r.tier, "T1");
  });

  it("setEdgeTier overrides specific edge", () => {
    reg("e2e.override", "T1");
    setEdgeTier("e2e.override", "T3", "env");
    assert.equal(getEdgeTier("e2e.override"), "T3");
  });

  it("full cycle: register, kill-switch, deactivate, reconcile", () => {
    reg("e2e.cycle", "T3");
    activateKillSwitchDegradation();
    assert.equal(resolveTier("cycle", undefined, { cpuPressure: 0, memPressure: 0 }).tier, "T1");
    deactivateKillSwitchDegradation();
    const r = resolveTier("e2e.cycle", undefined, { cpuPressure: 0, memPressure: 0 });
    assert.equal(r.tier, "T3");
    const c = __runOnceForTests({ killSwitchActive: false, cpuPressure: 0, memPressure: 0 });
    assert.equal(c, 0);
  });

  it("dispatchHotPath exports available", async () => {
    const mod = await import("../../open-sse/rpc/dispatchHotPath.ts");
    assert.equal(typeof mod.useDispatchForEdge, "function");
  });

  it("edge names are registerable", () => {
    for (const name of ["scoring.combo.scoreSimd", "sse.chunk.sseStream", "cache.semantic.lookup", "guardrails.pii.anonymize", "rateLimit.tokenBucket.consume"]) {
      registerEdge({ name, defaultTier: "T1", providerScope: [] });
    }
    assert.ok(true);
  });
});
