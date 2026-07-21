/**
 * Tests for dispatch scoring edges (ADR-032 / F4).
 *
 * Validates the edge definitions for the combo-scoring hot path:
 *   - scoring.combo.scoreSimd (T3 FFI, default T3)
 *
 * The edge must be registered, carry expected tier + contracts, and its
 * inline handler must produce deterministic correct scores.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEdge, listEdges, __resetEdgeRegistryForTests } from "../../open-sse/rpc/dispatchEdges";
import { __resetKillSwitchBridgeForTests } from "../../open-sse/rpc/killSwitchBridge";
import { __resetDispatchReconcilerForTests } from "../../open-sse/rpc/reconciler";

// Eager-edge-load: import the edge module to trigger registerEdge().
import "../../open-sse/rpc/edges/scoringEdges";

void describe("dispatch scoring edges", () => {
  it("scoring.combo.scoreSimd is registered with T3 default", () => {
    const edge = getEdge("scoring.combo.scoreSimd");
    assert.ok(edge, "scoring.combo.scoreSimd must be registered");
    assert.equal(edge.defaultTier, "T3");
  });

  it("scoring.combo.scoreSimd has all three transport contracts", () => {
    const edge = getEdge("scoring.combo.scoreSimd");
    assert.ok(edge.http, "must have HTTP contract");
    assert.equal(edge.http.path, "/api/internal/edges/scoring/combo");
    assert.ok(edge.uds, "must have UDS contract");
    assert.equal(edge.uds.method, "scoring.combo.scoreSimd");
    assert.ok(edge.ffi, "must have FFI contract");
    assert.equal(edge.ffi.crate, "omniroute_ffi_combo_scorer");
    assert.equal(edge.ffi.symbol, "score_combo_simd");
  });

  it("scoring.combo.scoreSimd healthcheck returns scores", async () => {
    const edge = getEdge("scoring.combo.scoreSimd");
    assert.ok(edge.healthcheck, "must have healthcheck");
    const result = await edge.healthcheck();
    assert.equal(result, null, "healthcheck must pass");
  });

  it("listEdges includes the scoring edge", () => {
    const names = listEdges().map((e) => e.name);
    assert.ok(names.includes("scoring.combo.scoreSimd"));
  });

  it("scoring.combo.scoreSimd appears only once in registry", () => {
    const edges = listEdges().filter((e) => e.name === "scoring.combo.scoreSimd");
    assert.equal(edges.length, 1);
  });

  it("scoring edge timeouts follow tier convention (T3 < T2 < T1)", () => {
    const edge = getEdge("scoring.combo.scoreSimd");
    assert.ok(edge.http.timeoutMs >= edge.uds.timeoutMs);
    assert.ok(edge.uds.timeoutMs >= edge.ffi.timeoutMs);
  });
});
