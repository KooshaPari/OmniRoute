/**
 * Pure embedding-similarity primitives for a future semantic cache.
 *
 * This module is intentionally self-contained: no network calls, no database
 * access, no imports from the live semantic cache, and no runtime side effects.
 */

export interface EmbeddingMatchEntry {
  key: string;
  vector: number[];
}

export interface EmbeddingBestMatch {
  key: string;
  score: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidVector(vector: unknown): vector is number[] {
  return Array.isArray(vector) && vector.length > 0 && vector.every(isFiniteNumber);
}

/**
 * Cosine similarity between two vectors.
 *
 * Returns 0 for empty vectors, dimension mismatches, or any non-finite input.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!isValidVector(a) || !isValidVector(b)) return 0;
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normASq = 0;
  let normBSq = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normASq += av * av;
    normBSq += bv * bv;
  }

  if (normASq === 0 || normBSq === 0) return 0;

  const denom = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (!Number.isFinite(denom) || denom === 0) return 0;

  const score = dot / denom;
  return Number.isFinite(score) ? score : 0;
}

/**
 * Normalize a vector to unit length.
 *
 * Returns a zero-filled vector of the same length for zero vectors or invalid
 * input (empty, non-array, or containing non-finite values) so callers always
 * receive a dimension-preserving, finite result.
 */
export function normalizeVector(a: number[]): number[] {
  if (!Array.isArray(a) || a.length === 0) return [];
  if (!a.every(isFiniteNumber)) return new Array(a.length).fill(0);

  let normSq = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    normSq += v * v;
  }

  if (normSq === 0) return new Array(a.length).fill(0);

  const norm = Math.sqrt(normSq);
  if (!Number.isFinite(norm) || norm === 0) return new Array(a.length).fill(0);

  return a.map((v) => v / norm);
}

/**
 * Find the best matching entry for a query embedding.
 *
 * Returns the highest-scoring entry whose score is >= threshold, or null if no
 * entry qualifies. Ties are broken deterministically by keeping the first entry
 * encountered in input order.
 */
export function findBestMatch(
  query: number[],
  entries: EmbeddingMatchEntry[],
  threshold: number
): EmbeddingBestMatch | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  if (!isFiniteNumber(threshold)) return null;

  let best: EmbeddingBestMatch | null = null;

  for (const entry of entries) {
    if (!entry || typeof entry.key !== "string" || !Array.isArray(entry.vector)) {
      continue;
    }

    const score = cosineSimilarity(query, entry.vector);
    if (score < threshold) continue;

    if (best === null || score > best.score) {
      best = { key: entry.key, score };
    }
  }

  return best;
}

/**
 * Create a stable, deterministic cache key fragment from an embedding vector by
 * quantizing each component to a fixed number of decimal places.
 *
 * Useful as an optional helper for future semantic-cache indexing strategies.
 * Returns an empty string for invalid/empty vectors or invalid precision.
 */
export function createQuantizedVectorKey(vector: number[], decimals = 4): string {
  if (!isValidVector(vector)) return "";
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) return "";

  const factor = 10 ** decimals;
  const quantized = vector.map((v) => {
    const q = Math.round(v * factor) / factor;
    // Normalize -0 to 0 for stable string keys.
    return Object.is(q, -0) ? 0 : q;
  });

  return `q${decimals}:${quantized.join(",")}`;
}
