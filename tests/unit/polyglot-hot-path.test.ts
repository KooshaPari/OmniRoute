/**
 * polyglot-hot-path.test.ts — Unit tests for the production hot-path helpers.
 *
 * Tests that chunkSseHotPath, scoreComboHotPath, consumeRateLimitHotPath,
 * and maskPiiHotPath correctly invoke the tier resolver and fall back to
 * in-process TS when the FFI / UDS binding is unavailable.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import the hot-path helpers (they must be available without cdylib).
let hot: Awaited<typeof import("../../open-sse/rpc/polyglotHotPath.ts")>;

describe("polyglotHotPath", async () => {
  hot = await import("../../open-sse/rpc/polyglotHotPath.ts");

  describe("chunkSseHotPath", () => {
    it("chunks a short body into one chunk", async () => {
      const body = 'data: {"hello":"world"}\n\n';
      const res = await hot.chunkSseHotPath(body, 4096, false);
      assert.ok(res.chunks.length >= 1);
      assert.ok(res.chunks[0].startsWith("data: "));
      assert.equal(res.totalBytes, body.length);
      assert.ok(["T1", "T2", "T3"].includes(res.tier));
    });

    it("splits long bodies at line boundaries", async () => {
      const longLine = "x".repeat(5000);
      const body = `${longLine}\n${longLine}`;
      const res = await hot.chunkSseHotPath(body, 1024, true);
      assert.ok(res.chunks.length > 1);
      res.chunks.forEach((c) => assert.ok(c.startsWith("data: ")));
    });

    it("empty body returns empty result", async () => {
      const res = await hot.chunkSseHotPath("", 4096, false);
      assert.equal(res.chunks.length, 0);
      assert.equal(res.totalBytes, 0);
    });
  });

  describe("scoreComboHotPath", () => {
    it("scores a single candidate", async () => {
      const candidates = [
        { id: "c1", features: new Float64Array([1, 2, 3, 4, 5]) },
      ];
      const res = await hot.scoreComboHotPath(candidates);
      assert.equal(res.length, 1);
      assert.equal(res[0].candidateId, "c1");
      assert.equal(typeof res[0].score, "number");
    });

    it("handles empty candidate list", async () => {
      const res = await hot.scoreComboHotPath([]);
      assert.equal(res.length, 0);
    });
  });

  describe("consumeRateLimitHotPath", () => {
    it("returns allowed by default", async () => {
      const res = await hot.consumeRateLimitHotPath("openai", 1, 1_000_000);
      assert.equal(res.allowed, true);
      assert.equal(typeof res.remaining, "number");
      assert.ok(["T1", "T2", "T3"].includes(res.tier));
    });
  });

  describe("maskPiiHotPath", () => {
    it("passes through text unchanged (no cdylib)", async () => {
      const text = "Hello world with email@example.com in it";
      const res = await hot.maskPiiHotPath(text);
      assert.equal(res.redacted, text);
      assert.ok(["T1", "T2", "T3"].includes(res.tier));
    });
  });

  describe("polyglotEdgeCount", () => {
    it("returns a positive integer", () => {
      const cnt = hot.polyglotEdgeCount();
      assert.equal(typeof cnt, "number");
      assert.ok(cnt > 0);
    });
  });
});
