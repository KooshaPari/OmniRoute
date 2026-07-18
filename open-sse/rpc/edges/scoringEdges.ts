/**
 * Combo scoring edges — T3 (FFI) primary, F4.
 *
 * The hot inner loop in `open-sse/handlers/chatCore.ts::handleChatCore()`
 * scores a pool of provider candidates on every request. The TypeScript
 * implementation in `open-sse/services/autoCombo/scoring.ts` is fast
 * enough at low RPS but becomes the second-largest CPU contributor at
 * sustained 5k RPS.
 *
 * Per ADR-032 § "Combo scoring (12-factor)":
 *   - Default tier T3 via the `omniroute_ffi_combo_scorer` crate (Rust +
 *     SIMD via `std::simd`/`packed_simd` + `aho-corasick` + `parking_lot`).
 *   - In-process TypeScript fast-path when the crate is missing.
 *
 * The dispatch order is:
 *   1. If FFI enabled + loaded → invoke Rust `score_combo_simd` (T3).
 *   2. Otherwise → TS reference implementation (T1 fast-path fallback).
 *
 * See `polyglot.omniidc` "service scoring" for the wire shape.
 * See `crates/omniroute-ffi/crates/combo-scorer/` for the FFI crate.
 */

import { registerEdge } from "../polyglotEdges.ts";
import type { EdgeTier } from "../polyglotEdges.ts";
import {
  calculateScore,
  scorePool,
  validateWeights,
  type ProviderCandidate,
  type ScoringWeights,
  DEFAULT_WEIGHTS,
} from "../../services/autoCombo/scoring.ts";
import {
  loadComboScorer,
  scoreBatchViaFfi,
  __resetComboScorerLoaderForTests,
} from "./scoringFfi.ts";
import { PolyglotEdgeError } from "../errors.ts";

export const SCORING_EDGE_TIER: EdgeTier = "T3";

export interface ComboScoreRequest {
  candidates: Array<{
    id: string;
    provider: string;
    model: string;
    quotaRemaining: number;
    quotaTotal: number;
    costPer1MTokens: number;
    p95LatencyMs: number;
    latencyStdDev: number;
    errorRate: number;
    taskFit: number;
    stability: number;
    tierPriority: number;
    tierAffinity: number;
    specificityMatch: number;
    contextAffinity: number;
    resetWindowAffinity: number;
    connectionDensity: number;
    circuitBreakerState: 0 | 1 | 2; // CLOSED|HALF_OPEN|OPEN
  }>;
  weights: ScoringWeights;
}

export interface ComboScoredResult {
  id: string;
  score: number;
}

export interface ComboScoreResponse {
  scored: ComboScoredResult[];
  totalDurationMicros: number;
}

async function t1ScoreSimdHandler(input: ComboScoreRequest): Promise<ComboScoreResponse> {
  const start = performance.now();
  const weights = input.weights ?? DEFAULT_WEIGHTS;

  // ── T3 path: FFI to Rust SIMD scorer ───────────────────────────────
  // Only attempted if the operator opted in via
  // `OMNIROUTE_FFI_COMBO_SCORER_ENABLED=1` AND the cdylib is on disk.
  // On any FFI failure (not loaded / load error / ABI mismatch) we fall
  // back to the TS reference impl — never throw out of the hot path.
  let ffiScores: number[] | null = null;
  if (process.env.OMNIROUTE_FFI_COMBO_SCORER_ENABLED === "1") {
    try {
      await loadComboScorer();
      const batch = input.candidates.map((c) => [
        clamp01(c.quotaRemaining / 100),
        c.circuitBreakerState === 0
          ? 1.0
          : c.circuitBreakerState === 1
            ? 0.5
            : 0.0,
        clamp01(1 - c.costPer1MTokens / 1000),
        clamp01(1 - c.p95LatencyMs / 5000),
        clamp01(c.taskFit),
        clamp01(c.stability),
        clamp01(c.tierPriority),
        clamp01(c.tierAffinity),
        clamp01(c.specificityMatch),
        clamp01(c.contextAffinity),
        clamp01(c.resetWindowAffinity),
        clamp01(c.connectionDensity),
      ]);
      const weightsVec = [
        weights.quota,
        weights.health,
        weights.costInv,
        weights.latencyInv,
        weights.taskFit,
        weights.stability,
        weights.tierPriority,
        weights.tierAffinity,
        weights.specificityMatch,
        weights.contextAffinity,
        weights.resetWindowAffinity,
        weights.connectionDensity,
      ];
      ffiScores = await scoreBatchViaFfi(batch, weightsVec);
    } catch (err: unknown) {
      if (!(err instanceof PolyglotEdgeError)) {
        // Unexpected error — log and fall back, but don't swallow silently.
        console.warn(
          "scoring_ffi_failed; falling back to TS",
          err instanceof Error ? err.message : String(err)
        );
      }
      ffiScores = null;
    }
  }

  const scored: ComboScoredResult[] = input.candidates.map((c, idx) => {
    const score =
      ffiScores?.[idx] ??
      calculateScore(
        {
          quota: clamp01(c.quotaRemaining / 100),
          health:
            c.circuitBreakerState === 0
              ? 1.0
              : c.circuitBreakerState === 1
                ? 0.5
                : 0.0,
          costInv: clamp01(1 - c.costPer1MTokens / 1000),
          latencyInv: clamp01(1 - c.p95LatencyMs / 5000),
          taskFit: clamp01(c.taskFit),
          stability: clamp01(c.stability),
          tierPriority: clamp01(c.tierPriority),
          tierAffinity: clamp01(c.tierAffinity),
          specificityMatch: clamp01(c.specificityMatch),
          contextAffinity: clamp01(c.contextAffinity),
          resetWindowAffinity: clamp01(c.resetWindowAffinity),
          connectionDensity: clamp01(c.connectionDensity),
        },
        weights
      );
    return { id: c.id, score };
  });

  return {
    scored: scored.sort((a, b) => b.score - a.score),
    totalDurationMicros: Math.round((performance.now() - start) * 1000),
  };
}

function clamp01(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export const SCORING_COMBO_SIMD = registerEdge<ComboScoreRequest, ComboScoreResponse>({
  name: "scoring.combo.scoreSimd",
  defaultTier: SCORING_EDGE_TIER,
  http: { path: "/api/internal/edges/scoring/combo", timeoutMs: 25 },
  uds: { method: "scoring.combo.scoreSimd", timeoutMs: 15 },
  ffi: { crate: "omniroute_ffi_combo_scorer", symbol: "score_combo_simd", timeoutMs: 10 },
  healthcheck: async () => {
    const r = await t1ScoreSimdHandler({
      candidates: [
        {
          id: "smoke",
          provider: "openai",
          model: "gpt-4o",
          quotaRemaining: 50,
          quotaTotal: 100,
          costPer1MTokens: 1,
          p95LatencyMs: 100,
          latencyStdDev: 10,
          errorRate: 0,
          taskFit: 0.5,
          stability: 0.5,
          tierPriority: 0.5,
          tierAffinity: 0.5,
          specificityMatch: 0.5,
          contextAffinity: 0.5,
          resetWindowAffinity: 0.5,
          connectionDensity: 0.5,
          circuitBreakerState: 0,
        },
      ],
      weights: DEFAULT_WEIGHTS,
    });
    return r.scored[0]?.score !== undefined ? null : "scoring smoke produced no score";
  },
});

// Re-export validation helper so callers can pre-check weights before invoking.
export { validateWeights, scorePool };
