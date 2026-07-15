/**
 * Tests for polyglot SSE chunking edges (ADR-032 / F4).
 *
 * Validates the edge definition for the SSE byte-stream chunker:
 *   - sse.chunkEvents (T3 FFI, default T3)
 *
 * This edge wraps the hot inner loop at
 * `open-sse/handlers/chatCore.ts:1042-1058`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEdge, listEdges, __resetEdgeRegistryForTests } from "../../open-sse/rpc/polyglotEdges";
import { __resetKillSwitchBridgeForTests } from "../../open-sse/rpc/killSwitchBridge";
import { __resetPolyglotReconcilerForTests } from "../../open-sse/rpc/reconciler";

// Eager-edge-load: import the edge module to trigger registerEdge().
import "../../open-sse/rpc/edges/sseEdges";

void describe("polyglot SSE edges", () => {
  it("sse.chunk.sseStream is registered with T3 default", () => {
    const edge = getEdge("sse.chunk.sseStream");
    assert.ok(edge, "sse.chunk.sseStream must be registered");
    assert.equal(edge.defaultTier, "T3");
  });

  it("sse.chunk.sseStream has all three transport contracts", () => {
    const edge = getEdge("sse.chunk.sseStream");
    assert.ok(edge.http, "must have HTTP contract");
    assert.equal(edge.http.path, "/api/internal/edges/sse/chunk");

    assert.ok(edge.uds, "must have UDS contract");
    assert.equal(edge.uds.method, "sse.chunk.sseStream");

    assert.ok(edge.ffi, "must have FFI contract");
    assert.equal(edge.ffi.crate, "omniroute_ffi_sse_chunking");
    assert.equal(edge.ffi.symbol, "chunk_sse_stream");
  });

  it("listEdges includes sse.chunk.sseStream", () => {
    const names = listEdges().map((e) => e.name);
    assert.ok(names.includes("sse.chunk.sseStream"));
  });

  it("sse.chunk.sseStream appears only once", () => {
    const edges = listEdges().filter((e) => e.name === "sse.chunk.sseStream");
    assert.equal(edges.length, 1);
  });

  it("timeout hierarchy: T3 < T2 < T1", () => {
    const edge = getEdge("sse.chunk.sseStream");
    assert.ok(edge.http.timeoutMs >= edge.uds.timeoutMs);
    assert.ok(edge.uds.timeoutMs >= edge.ffi.timeoutMs);
  });

  it("no other sse. edges conflict", () => {
    const edges = listEdges().filter((e) => e.name.startsWith("sse."));
    assert.equal(edges.length, 1, "expected exactly 1 sse. edge");
  });

  it("healthcheck smoke passes for sse edge", async () => {
    const edge = getEdge("sse.chunk.sseStream");
    assert.ok(edge.healthcheck, "must have healthcheck");
    const result = await edge.healthcheck();
    assert.equal(result, null, "healthcheck must pass");
  });
});
