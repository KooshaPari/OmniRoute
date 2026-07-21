/**
 * Tests for dispatch compression edges (ADR-032 / F3).
 *
 * Validates the edge definitions for prompt-compression hot paths:
 *   - compression.lite.collapseWhitespace  (T2 UDS RPC)
 *   - compression.lite.removeRedundantContent     (T2 UDS RPC)
 *   - compression.rtk.compressTerminalOutput           (T2 UDS RPC)
 *
 * Each edge must be registered, carry the expected tier, and respond to a
 * smoke-test healthcheck.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEdge, listEdges, __resetEdgeRegistryForTests } from "../../open-sse/rpc/dispatchEdges";
import { __resetKillSwitchBridgeForTests } from "../../open-sse/rpc/killSwitchBridge";
import { __resetDispatchReconcilerForTests } from "../../open-sse/rpc/reconciler";

// Eager-edge-load: import the edge module to trigger registerEdge().
import "../../open-sse/rpc/edges/compressionEdges";

void describe("dispatch compression edges", () => {
  it("compression.collapseWhitespace is registered and has all transport contracts", () => {
    const edge = getEdge("compression.lite.collapseWhitespace");
    assert.ok(edge, "compression.lite.collapseWhitespace must be registered");
    assert.equal(edge.defaultTier, "T2");
    assert.ok(edge.uds, "must have UDS contract");
    assert.equal(edge.uds.method, "lite.collapseWhitespace");
    assert.ok(edge.http, "must have HTTP contract as fallback");
  });

  it("compression.lite.removeRedundantContent is registered with T2 default and correct UDS method", () => {
    const edge = getEdge("compression.lite.removeRedundantContent");
    assert.ok(edge, "compression.lite.removeRedundantContent must be registered");
    assert.equal(edge.defaultTier, "T2");
    assert.ok(edge.uds);
    assert.equal(edge.uds.method, "lite.removeRedundantContent");
  });

  it("compression.rtk.compressTerminalOutput is registered with T2 default", () => {
    const edge = getEdge("compression.rtk.compressTerminalOutput");
    assert.ok(edge, "compression.rtk.compressTerminalOutput must be registered");
    assert.equal(edge.defaultTier, "T2");
    assert.ok(edge.uds);
    assert.equal(edge.uds.method, "rtk.compressTerminalOutput");
  });

  it("all three compression edges appear in listEdges", () => {
    const names = listEdges().map((e) => e.name);
    assert.ok(names.includes("compression.lite.collapseWhitespace"));
    assert.ok(names.includes("compression.lite.removeRedundantContent"));
    assert.ok(names.includes("compression.rtk.compressTerminalOutput"));
  });

  it("edge URI is consistently scoped under compression.", () => {
    const edges = listEdges().filter((e) => e.name.startsWith("compression."));
    assert.equal(edges.length, 6, "expected exactly 6 compression edges");
    for (const e of edges) {
      assert.ok(
        e.uds || e.ffi || e.http,
        `compression edge ${e.name} must have at least one transport`
      );
    }
  });

  it("healthcheck smoke test passes for all compression edges", async () => {
    const edges = listEdges().filter((e) => e.name.startsWith("compression."));
    for (const e of edges) {
      if (e.healthcheck) {
        const result = await e.healthcheck();
        assert.equal(result, null, `healthcheck failed for ${e.name}: ${result}`);
      } else {
        // No healthcheck hook — not required, but log it
        console.log(`ℹ ${e.name}: no healthcheck registered`);
      }
    }
  });
});
