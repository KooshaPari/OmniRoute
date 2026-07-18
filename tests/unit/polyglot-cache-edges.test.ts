/**
 * Tests for polyglot cache edges (ADR-032 / F5).
 *
 * Validates the edge definitions for the semantic/reasoning-cache hot path:
 *   - cache.semantic.lookup      (T3 FFI)
 *   - cache.reasoning.replay     (T3 FFI)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEdge, listEdges, __resetEdgeRegistryForTests } from "../../open-sse/rpc/polyglotEdges";
import { __resetKillSwitchBridgeForTests } from "../../open-sse/rpc/killSwitchBridge";
import { __resetPolyglotReconcilerForTests } from "../../open-sse/rpc/reconciler";

// Eager-edge-load: import the edge module to trigger registerEdge().
import "../../open-sse/rpc/edges/cacheEdges";

void describe("polyglot cache edges", () => {
  it("cache.semantic.lookup is registered with T3 default", () => {
    const edge = getEdge("cache.semantic.lookup");
    assert.ok(edge, "cache.semantic.lookup must be registered");
    assert.equal(edge.defaultTier, "T3");
    assert.ok(edge.ffi, "must have FFI contract");
    assert.equal(edge.ffi.crate, "omniroute_ffi_signature_cache");
  });

  it("cache.reasoning.replay is registered with T3 default", () => {
    const edge = getEdge("cache.reasoning.replay");
    assert.ok(edge, "cache.reasoning.replay must be registered");
    assert.equal(edge.defaultTier, "T3");
    assert.ok(edge.uds, "must have UDS contract");
    assert.equal(edge.uds.method, "cache.reasoning.replay");
    assert.ok(edge.ffi, "must have FFI contract");
  });

  it("both cache edges appear in listEdges", () => {
    const names = listEdges().map((e) => e.name);
    assert.ok(names.includes("cache.semantic.lookup"));
    assert.ok(names.includes("cache.reasoning.replay"));
  });

  it("cache edges are scoped under cache. prefix", () => {
    const edges = listEdges().filter((e) => e.name.startsWith("cache."));
    assert.equal(edges.length, 2, "expected exactly 2 cache edges");
  });

  it("each cache edge has at least one transport contract", () => {
    const edges = listEdges().filter((e) => e.name.startsWith("cache."));
    for (const e of edges) {
      assert.ok(
        e.http || e.uds || e.ffi,
        `cache edge ${e.name} must have at least one transport`
      );
    }
  });
});
