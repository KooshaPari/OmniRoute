import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  _injectPipeline,
  _injectTransformersCompanionLoaderForTests,
} from "../../src/lib/memory/embedding/transformersLocal";

// Note: @huggingface/transformers is NEVER imported at module level in production code.
// This test verifies the singleton pattern and error handling using injected mocks.

describe("memory-embedding-transformers", () => {
  beforeEach(() => {
    // Reset pipeline singleton
    _injectPipeline(null);
    _injectTransformersCompanionLoaderForTests(null);
  });

  it("_injectPipeline and embedTransformers use mock pipeline", async () => {
    // Inject a mock pipeline that returns a Tensor-like object
    let callCount = 0;
    const mockPipeline = async (_text: string | string[], _opts?: Record<string, unknown>) => {
      callCount++;
      // Return a Tensor-like object with dims [1, 1, 4] and data
      return {
        dims: [1, 1, 4],
        data: new Float32Array([0.1, 0.2, 0.3, 0.4]),
      };
    };

    _injectPipeline(mockPipeline);

    const { embedTransformers } = await import("../../src/lib/memory/embedding/transformersLocal");
    const result = await embedTransformers("hello world");

    assert.ok("vector" in result, "Should return EmbeddingResult");
    const r = result as {
      vector: Float32Array;
      source: string;
      dimensions: number;
      cached: boolean;
    };
    assert.ok(r.vector instanceof Float32Array);
    assert.strictEqual(r.source, "transformers");
    assert.strictEqual(r.dimensions, 4);
    assert.strictEqual(r.cached, false);
    assert.strictEqual(callCount, 1);
  });

  it("singleton: second call reuses existing pipeline (no double init)", async () => {
    let initCount = 0;
    _injectPipeline(async () => {
      initCount++;
      return { dims: [1, 1, 4], data: new Float32Array([0.5, 0.6, 0.7, 0.8]) };
    });

    const { embedTransformers } = await import("../../src/lib/memory/embedding/transformersLocal");
    await embedTransformers("first call");
    await embedTransformers("second call");

    // Pipeline function was called twice (once per text), but init should
    // only happen once since _injectPipeline sets the singleton directly
    assert.strictEqual(
      initCount,
      2,
      "pipeline function called twice but init (inject) happened once"
    );
  });

  it("returns EmbeddingError{reason:model_load_failed} when pipeline throws on load", async () => {
    // Clear the singleton so getOrLoadPipeline() tries the optional companion.
    _injectPipeline(null);

    const { embedTransformers } = await import("../../src/lib/memory/embedding/transformersLocal");
    const result = await embedTransformers("the companion is intentionally absent in base CI");

    assert.ok("reason" in result, "missing companion must return a structured failure");
    const embErr = result as { source: string; reason: string; message: string };
    assert.strictEqual(embErr.source, "transformers");
    assert.strictEqual(embErr.reason, "model_load_failed");
    assert.ok(typeof embErr.message === "string");
    assert.ok(!embErr.message.includes("at /"), "No stack trace in message");
  });

  it("retries a later load after an initial companion failure", async () => {
    let attempts = 0;
    _injectTransformersCompanionLoaderForTests(async () => {
      attempts++;
      if (attempts === 1) throw new Error("temporary companion failure");
      return {
        loadTransformers: async () => ({
          pipeline: async () => async () => ({
            dims: [1, 1, 2],
            data: new Float32Array([0.25, 0.75]),
          }),
        }),
      };
    });

    const { embedTransformers } = await import("../../src/lib/memory/embedding/transformersLocal");
    const first = await embedTransformers("first attempt");
    const second = await embedTransformers("second attempt");

    assert.equal((first as { reason: string }).reason, "model_load_failed");
    assert.ok("vector" in second, "a transient load failure must not poison later calls");
    assert.equal(attempts, 2);
  });

  it("handles Tensor with 2D dims [seq_len, hidden_size]", async () => {
    _injectPipeline(async () => {
      return {
        dims: [2, 4], // [seq_len=2, hidden=4]
        data: new Float32Array([1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0]),
      };
    });

    const { embedTransformers } = await import("../../src/lib/memory/embedding/transformersLocal");
    const result = await embedTransformers("test");

    assert.ok("vector" in result);
    const r = result as { vector: Float32Array; dimensions: number };
    assert.strictEqual(r.dimensions, 4);
    // Mean of rows [1,0,0,0] and [0,1,0,0] = [0.5, 0.5, 0, 0]
    assert.ok(Math.abs(r.vector[0] - 0.5) < 0.001);
    assert.ok(Math.abs(r.vector[1] - 0.5) < 0.001);
  });

  it("handles 3D Tensor dims [batch=1, seq_len, hidden_size]", async () => {
    _injectPipeline(async () => {
      return {
        dims: [1, 2, 4], // [batch=1, seq_len=2, hidden=4]
        data: new Float32Array([2.0, 0.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0]),
      };
    });

    const { embedTransformers } = await import("../../src/lib/memory/embedding/transformersLocal");
    const result = await embedTransformers("test");

    assert.ok("vector" in result);
    const r = result as { vector: Float32Array; dimensions: number };
    assert.strictEqual(r.dimensions, 4);
    assert.ok(Math.abs(r.vector[0] - 1.0) < 0.001);
    assert.ok(Math.abs(r.vector[1] - 1.0) < 0.001);
  });

  it("pipeline error in embed() returns EmbeddingError{reason:request_failed}", async () => {
    _injectPipeline(async () => {
      throw new Error("Unexpected model output");
    });

    const { embedTransformers } = await import("../../src/lib/memory/embedding/transformersLocal");
    const result = await embedTransformers("test");

    assert.ok("reason" in result);
    const r = result as { reason: string; source: string; message: string };
    assert.strictEqual(r.source, "transformers");
    assert.ok(r.reason === "request_failed" || r.reason === "timeout");
    assert.ok(!r.message.includes("at /"), "No stack trace in sanitized message");
  });
});
