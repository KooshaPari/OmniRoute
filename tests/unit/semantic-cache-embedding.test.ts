import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  cosineSimilarity,
  createQuantizedVectorKey,
  findBestMatch,
  normalizeVector,
  type EmbeddingMatchEntry,
} from "../../src/lib/semanticCacheEmbedding.ts";

function assertClose(actual: number, expected: number, epsilon = 1e-12): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

describe("semanticCacheEmbedding", () => {
  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      assertClose(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
      assertClose(cosineSimilarity([2, 2], [2, 2]), 1);
      assertClose(cosineSimilarity([3, 4], [6, 8]), 1);
    });

    it("returns 0 for orthogonal vectors", () => {
      assertClose(cosineSimilarity([1, 0], [0, 1]), 0);
      assertClose(cosineSimilarity([2, 0, 0], [0, 5, 0]), 0);
    });

    it("returns -1 for opposite vectors", () => {
      assertClose(cosineSimilarity([1, 0], [-1, 0]), -1);
      assertClose(cosineSimilarity([2, 3], [-2, -3]), -1);
    });

    it("returns 0 for dimension mismatch", () => {
      assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
      assert.equal(cosineSimilarity([1], [1, 0]), 0);
    });

    it("returns 0 for empty vectors", () => {
      assert.equal(cosineSimilarity([], []), 0);
      assert.equal(cosineSimilarity([1, 2], []), 0);
      assert.equal(cosineSimilarity([], [1, 2]), 0);
    });

    it("returns 0 for zero vectors", () => {
      assert.equal(cosineSimilarity([0, 0], [0, 0]), 0);
      assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
      assert.equal(cosineSimilarity([1, 2, 3], [0, 0, 0]), 0);
    });

    it("returns 0 for NaN or Infinity inputs", () => {
      assert.equal(cosineSimilarity([NaN, 1], [1, 1]), 0);
      assert.equal(cosineSimilarity([1, 1], [1, NaN]), 0);
      assert.equal(cosineSimilarity([Infinity, 0], [1, 0]), 0);
      assert.equal(cosineSimilarity([1, 0], [-Infinity, 0]), 0);
      assert.equal(cosineSimilarity([Number.POSITIVE_INFINITY, NaN], [1, 2]), 0);
    });
  });

  describe("normalizeVector", () => {
    it("normalizes a vector to unit length", () => {
      const normalized = normalizeVector([3, 4]);
      assert.equal(normalized.length, 2);
      assertClose(normalized[0]!, 0.6);
      assertClose(normalized[1]!, 0.8);

      const norm = Math.hypot(...normalized);
      assertClose(norm, 1);
    });

    it("handles zero vectors by returning a same-length zero vector", () => {
      assert.deepEqual(normalizeVector([0, 0, 0]), [0, 0, 0]);
      assert.deepEqual(normalizeVector([0]), [0]);
    });

    it("returns an empty array for empty input", () => {
      assert.deepEqual(normalizeVector([]), []);
    });

    it("returns a same-length zero vector for NaN or Infinity input", () => {
      assert.deepEqual(normalizeVector([NaN, 1]), [0, 0]);
      assert.deepEqual(normalizeVector([Infinity, -1, 2]), [0, 0, 0]);
      assert.deepEqual(normalizeVector([1, -Infinity]), [0, 0]);
    });

    it("preserves direction for negative values", () => {
      const normalized = normalizeVector([-3, 4]);
      assertClose(normalized[0]!, -0.6);
      assertClose(normalized[1]!, 0.8);
    });
  });

  describe("findBestMatch", () => {
    it("returns the best matching entry at or above the threshold", () => {
      const entries: EmbeddingMatchEntry[] = [
        { key: "orthogonal", vector: [0, 1] },
        { key: "identical", vector: [1, 0] },
        { key: "similar", vector: [0.8, 0.6] },
      ];

      const match = findBestMatch([1, 0], entries, 0.9);
      assert.deepEqual(match, { key: "identical", score: 1 });
    });

    it("returns null when no entry meets the threshold", () => {
      const entries: EmbeddingMatchEntry[] = [
        { key: "orthogonal", vector: [0, 1] },
        { key: "opposite", vector: [-1, 0] },
      ];

      assert.equal(findBestMatch([1, 0], entries, 0.5), null);
    });

    it("treats the threshold as inclusive at the boundary", () => {
      const entries: EmbeddingMatchEntry[] = [
        { key: "orthogonal", vector: [0, 1] },
      ];

      const boundary = findBestMatch([1, 0], entries, 0);
      assert.ok(boundary);
      assert.equal(boundary.key, "orthogonal");
      assertClose(boundary.score, 0);

      assert.equal(findBestMatch([1, 0], entries, 0.0000001), null);
    });

    it("breaks ties deterministically by keeping the first entry", () => {
      const entries: EmbeddingMatchEntry[] = [
        { key: "first", vector: [1, 0] },
        { key: "second", vector: [1, 0] },
        { key: "third", vector: [1, 0] },
      ];

      const match = findBestMatch([1, 0], entries, 0.5);
      assert.deepEqual(match, { key: "first", score: 1 });
    });

    it("ignores dimension-mismatched, invalid, and zero-match entries when selecting", () => {
      const entries: EmbeddingMatchEntry[] = [
        { key: "mismatch", vector: [1, 0, 0] },
        { key: "zero", vector: [0, 0] },
        { key: "nan", vector: [NaN, 0] },
        { key: "valid", vector: [0, 1] },
      ];

      const match = findBestMatch([0, 1], entries, 0.5);
      assert.deepEqual(match, { key: "valid", score: 1 });
    });

    it("returns null for invalid queries or invalid thresholds", () => {
      const entries: EmbeddingMatchEntry[] = [{ key: "a", vector: [1, 0] }];

      assert.equal(findBestMatch([NaN, 0], entries, 0.5), null);
      assert.equal(findBestMatch([1, 0], entries, Number.NaN), null);
      assert.equal(findBestMatch([1, 0], entries, Number.POSITIVE_INFINITY), null);
      assert.equal(findBestMatch([], entries, 0.5), null);
      assert.equal(findBestMatch([1, 0], [], 0.5), null);
    });
  });

  describe("createQuantizedVectorKey", () => {
    it("creates a stable deterministic key for the same vector and precision", () => {
      const a = createQuantizedVectorKey([0.123456, -0.987654, 1], 4);
      const b = createQuantizedVectorKey([0.123456, -0.987654, 1], 4);
      assert.equal(a, b);
      assert.equal(a, "q4:0.1235,-0.9877,1");
    });

    it("changes when vector values or precision change", () => {
      assert.notEqual(
        createQuantizedVectorKey([0.1, 0.2], 3),
        createQuantizedVectorKey([0.1, 0.2], 2)
      );
      assert.notEqual(
        createQuantizedVectorKey([0.1, 0.2], 3),
        createQuantizedVectorKey([0.1, 0.2006], 3)
      );
    });

    it("returns an empty string for invalid vectors or precision", () => {
      assert.equal(createQuantizedVectorKey([], 4), "");
      assert.equal(createQuantizedVectorKey([NaN, 1], 4), "");
      assert.equal(createQuantizedVectorKey([1, Infinity], 4), "");
      assert.equal(createQuantizedVectorKey([1, 2], -1), "");
      assert.equal(createQuantizedVectorKey([1, 2], 1.5), "");
    });

    it("normalizes negative zero for stable output", () => {
      assert.equal(createQuantizedVectorKey([-0, 0], 2), "q2:0,0");
    });
  });
});
