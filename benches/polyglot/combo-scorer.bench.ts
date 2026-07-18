#!/usr/bin/env node
/**
 * combo-scorer.bench.ts — TS vs SIMD Rust combo scorer (ADR-032 / F4)
 *
 * Measures the in-process TypeScript `calculateScore()` hot loop against
 * the Rust SIMD cdylib path. The TS path is the baseline T1/T2 fallback;
 * the Rust path is the T3 target.
 *
 * The benchmark fabricates a pool of N provider candidates and calls
 * `scorePool()` or the direct `calculateScore()` in a tight loop.
 *
 * Usage:
 *   node --import tsx/esm benches/polyglot/combo-scorer.bench.ts
 */

import { bench } from "./shared.ts";
import { calculateScore } from "../../open-sse/services/autoCombo/scoring.ts";
import type { ScoringFactors } from "../../open-sse/services/autoCombo/scoring.ts";

// ── Fabricated candidate data ──────────────────────────────────────
// 1000 candidates with varying randomly-seeded-but-deterministic
// factor values to stress the weighted-sum path.
const CANDIDATES: ScoringFactors[] = Array.from({ length: 50 }, (_, i) => ({
  quota: clamp(0.1 + (i % 7) * 0.05, 0, 1),
  health: clamp(0.5 + (i % 11) * 0.03, 0, 1),
  costInv: clamp(0.3 + (i % 13) * 0.02, 0, 1),
  latencyInv: clamp(0.4 + (i % 17) * 0.04, 0, 1),
  taskFit: clamp(0.6 + (i % 19) * 0.01, 0, 1),
  stability: clamp(0.7 + (i % 23) * 0.02, 0, 1),
  tierPriority: clamp(0.2 + (i % 5) * 0.1, 0, 1),
  tierAffinity: clamp(0.3 + (i % 3) * 0.1, 0, 1),
  specificityMatch: clamp(0.5 + (i % 29) * 0.01, 0, 1),
  contextAffinity: clamp(0.4 + (i % 31) * 0.02, 0, 1),
  resetWindowAffinity: clamp(0.6 + (i % 37) * 0.01, 0, 1),
  connectionDensity: clamp(0.3 + (i % 41) * 0.015, 0, 1),
}));

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

const ITERATIONS = 5000;
const WEIGHTS = {
  quota: 0.08,
  health: 0.15,
  costInv: 0.1,
  latencyInv: 0.1,
  taskFit: 0.2,
  stability: 0.1,
  tierPriority: 0.05,
  tierAffinity: 0.05,
  specificityMatch: 0.05,
  contextAffinity: 0.05,
  resetWindowAffinity: 0.02,
  connectionDensity: 0.05,
};

let idx = 0;

const result = await bench({
  name: "combo-scorer-ts-calculateScore",
  tier: "T3",
  edge: "scoring.combo.scoreSimd",
  description: "TypeScript calculateScore() for 1 candidate with 12 factors",
  iterations: ITERATIONS,
  run: () => {
    const candidate = CANDIDATES[idx++ % CANDIDATES.length];
    return calculateScore(candidate, WEIGHTS);
  },
});

console.log(JSON.stringify(result, null, 2));
