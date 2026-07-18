#!/usr/bin/env node
/**
 * semantic-lookup.bench.ts — SQLite scan vs simhash (ADR-032 / F5)
 *
 * Benchmarks the in-process signature cache lookup (`getSignatures()`)
 * against a simulated simhash Hamming-distance search.
 *
 * The TS baseline: `Array.some()` over a string set (real implementation
 * in `open-sse/services/signatureCache.ts`).
 * The T3 target: Rust simhash via `twox-hash` + `dashmap`.
 *
 * Usage:
 *   node --import tsx/esm benches/polyglot/semantic-lookup.bench.ts
 */

import { bench } from "./shared.ts";

// ── Fabricated data ────────────────────────────────────────────────
// 200 synthetic signature patterns, each 8–64 chars.
const SIGNATURES: string[] = Array.from({ length: 200 }, (_, i) => {
  const len = 8 + (i * 7 + i * i) % 56;
  return "sig_" + "x".repeat(len).split("").map((_, j) => String.fromCharCode(97 + (i + j) % 26)).join("");
});

const QUERIES: string[] = Array.from({ length: 100 }, (_, i) => {
  // Some queries hit, some miss (~30% hit rate).
  if (i % 3 === 0) return SIGNATURES[i % SIGNATURES.length];
  return "non_existent_pattern_" + i;
});

const ITERATIONS = 2000;
let qIdx = 0;

// TS baseline: substring scan via Array.some()
const result = await bench({
  name: "semantic-lookup-ts-some",
  tier: "T3",
  edge: "cache.semantic.lookup",
  description:
    "TS Array.some() substring scan across 200 signature patterns (simulated simhash baseline)",
  iterations: ITERATIONS,
  run: () => {
    const query = QUERIES[qIdx++ % QUERIES.length];
    const hit = SIGNATURES.some((sig) => query.includes(sig) || sig.includes(query));
    return hit;
  },
});

console.log(JSON.stringify(result, null, 2));
