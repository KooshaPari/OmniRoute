/**
 * Smart Routing A2A Skill
 *
 * Picks the optimal (provider, model) pair for a prompt from a list of
 * candidates, balancing cost / latency / quality / preference according
 * to a strategy hint. The skill is read-only — it does not enqueue or
 * forward any LLM call. Use it as the decision engine that sits in front
 * of an actual dispatch (e.g. agentDispatch).
 *
 * Strategy matrix (weights sum to 1.0):
 *
 *   | strategy  | cost | latency | quality | preference |
 *   |-----------|------|---------|---------|------------|
 *   | cost      | 0.85 | 0.05    | 0.05    | 0.05       |
 *   | speed     | 0.05 | 0.85    | 0.05    | 0.05       |
 *   | quality   | 0.05 | 0.05    | 0.85    | 0.05       |
 *   | balanced  | 0.40 | 0.20    | 0.30    | 0.10       |
 *
 * Each axis is normalized to [0..1] across the viable cohort: cost and
 * latency are inverted (cheaper/faster is better), quality is taken
 * as-is (already [0..1]), preference is binary (preferred=1, else=0).
 *
 * Sources of truth:
 *   - Pricing: `src/shared/constants/pricing.ts` — the DEFAULT_CANDIDATES
 *     values are aligned with `getPricingForModel(provider, model)` for
 *     the SOTA models the fleet uses (claude-3-5-sonnet, gpt-4o,
 *     gemini-1.5-pro, …) and are encoded as $ per 1K tokens.
 *   - Quality: a hand-curated tier table (matches the `qualityScore`
 *     field on `Candidate`). Production deployments may swap this for
 *     `getResolvedTaskFitness()` from `src/lib/db/modelIntelligence.ts`
 *     (arena ELO + models.dev tier), but that requires a DB handle and
 *     is intentionally out of scope for this read-only skill.
 *   - Latency: caller-supplied `avgLatencyMs` on the `Candidate`. When
 *     unknown, the value is replaced with `syntheticLatencyMs()` at
 *     scoring time (50ms per output token, 200ms floor).
 *
 * Inputs (via task.metadata):
 *   - prompt              (required, string) the user prompt to route.
 *   - strategy_hint       (optional, "cost" | "speed" | "quality" |
 *                          "balanced"; default "balanced").
 *   - candidates          (optional, Candidate[]) — when omitted, falls
 *                          back to DEFAULT_CANDIDATES (the fleet catalog).
 *   - max_cost_usd        (optional, number) — soft cap; if every viable
 *                          candidate exceeds this, recommendation flips
 *                          to "reject" with reason "exceeds_max_cost".
 *   - excluded_providers  (optional, string[]) — providers to skip.
 *   - preferred_providers (optional, string[]) — providers to boost on
 *                          the preference axis (binary 0/1).
 *   - required_capabilities (optional, string[]) — candidates missing
 *                          any of these are marked disqualified.
 *   - tokens_in / tokens_out (optional, number) — when omitted, the
 *                          skill estimates input from prompt length
 *                          (4 chars/token) and uses an 800-token output
 *                          default for cost projection.
 *
 * Output (A2ASkillResult.artifacts[0].content is JSON):
 *   {
 *     chosen:   { providerId, modelId, vendor, score, … } | null,
 *     runnerUp: Array<{ providerId, modelId, score, reason, … }>,  // ≤ 3
 *     recommendation: "route" | "reject",
 *     reason:   "ok" | "no_candidates" | "exceeds_max_cost"
 *             | "all_disqualified",
 *     rubric:   { weights, candidatesEvaluated, candidatesDisqualified },
 *     warnings: string[]
 *   }
 *
 * Companion exports (exported for unit tests and for downstream
 * composition, e.g. an in-process router that needs the same ranking
 * logic without the A2A envelope):
 *   - rankCandidates(request)  → SmartRoutingResult
 *   - scoreCandidates(request, candidates) → ScoreCandidatesResult
 *   - pickBest(scored, rubric, maxCostUsd) → PickBestResult
 *   - estimateTokensFromPrompt(prompt)     → number
 *   - estimateCostForCandidate(c, in, out) → number
 *   - syntheticLatencyMs(outputTokens)     → number
 *   - DEFAULT_CANDIDATES, BALANCED_WEIGHTS, STRATEGY_WEIGHTS,
 *     CHARS_PER_TOKEN, DEFAULT_OUTPUT_TOKENS
 */

import { A2ATask } from "../taskManager";
import { A2ASkillResult } from "../taskExecution";

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────

export type StrategyHint = "cost" | "speed" | "quality" | "balanced";

export interface Candidate {
  providerId: string;
  modelId: string;
  vendor: string;
  /** USD per 1,000 input tokens. */
  costPer1kInput: number;
  /** USD per 1,000 output tokens. */
  costPer1kOutput: number;
  /** Rolling average latency in ms for a typical request. 0 = unknown. */
  avgLatencyMs: number;
  /** Quality tier in [0..1] (1 = SOTA). */
  qualityScore: number;
  /** Capability set; consulted when request.required_capabilities is set. */
  capabilities: Set<string>;
  /** False → candidate is disqualified with reason="unavailable". */
  available: boolean;
}

export interface ScoredCandidate {
  providerId: string;
  modelId: string;
  vendor: string;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  qualityScore: number;
  /** [0..1], higher = cheaper. */
  costNorm: number;
  /** [0..1], higher = faster. */
  latencyNorm: number;
  /** [0..1] (passthrough from Candidate.qualityScore). */
  qualityNorm: number;
  /** Binary 0/1 — preferred providers get a 1.0 boost. */
  preferenceNorm: number;
  /** Weighted aggregate; 0 when disqualified. */
  score: number;
  disqualified: boolean;
  reason:
    | "unavailable"
    | "excluded"
    | "missing_capabilities"
    | null;
  missingCapabilities: string[];
}

export interface ChosenCandidate {
  providerId: string;
  modelId: string;
  vendor: string;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  qualityScore: number;
  score: number;
}

export interface RunnerUpCandidate extends ChosenCandidate {
  reason: string;
}

export interface Rubric {
  weights: Record<"cost" | "latency" | "quality" | "preference", number>;
  candidatesEvaluated: number;
  candidatesDisqualified: number;
}

export interface SmartRoutingRequest {
  prompt: string;
  strategy_hint?: StrategyHint;
  candidates?: Candidate[];
  max_cost_usd?: number;
  excluded_providers?: string[];
  preferred_providers?: string[];
  required_capabilities?: string[];
  /** Explicit token counts; overrides the prompt-length estimator. */
  tokens_in?: number;
  tokens_out?: number;
}

export type Recommendation = "route" | "reject";

export type DecisionReason =
  | "ok"
  | "no_candidates"
  | "exceeds_max_cost"
  | "all_disqualified";

export interface SmartRoutingResult {
  chosen: ChosenCandidate | null;
  runnerUp: RunnerUpCandidate[];
  recommendation: Recommendation;
  reason: DecisionReason;
  rubric: Rubric;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Constants — calibrated against src/shared/constants/pricing.ts and
// the public arena-ELO snapshot (Jan 2026) at the time of authoring.
// ─────────────────────────────────────────────────────────────────────

/**
 * Strategy weights — each row sums to 1.0. Exposed so the rubric is
 * inspectable in the result payload (and in tests).
 *
 * Asymmetry is intentional: each strategy needs the primary axis
 * dominant enough to overcome the others even when a candidate is
 * weak on every other axis. E.g. the quality strategy puts 85% of
 * the weight on quality so a top-quality model wins even when it is
 * 10× more expensive and 3× slower than the cheapest cohort member.
 */
export const STRATEGY_WEIGHTS: Record<StrategyHint, Rubric["weights"]> = {
  cost: { cost: 0.85, latency: 0.05, quality: 0.05, preference: 0.05 },
  speed: { cost: 0.05, latency: 0.85, quality: 0.05, preference: 0.05 },
  quality: { cost: 0.05, latency: 0.05, quality: 0.85, preference: 0.05 },
  balanced: { cost: 0.4, latency: 0.2, quality: 0.3, preference: 0.1 },
};

/** Convenience alias used by callers/tests. */
export const BALANCED_WEIGHTS: Rubric["weights"] = STRATEGY_WEIGHTS.balanced;

/** Default output-token budget used when the caller does not specify. */
export const DEFAULT_OUTPUT_TOKENS = 800;

/** 4-chars-per-token heuristic — matches the costAnalysis skill. */
export const CHARS_PER_TOKEN = 4;

/**
 * Synthetic latency floor for candidates with no measured history:
 * 50ms per output token, minimum 200ms.
 */
export const SYNTHETIC_LATENCY_MS_PER_OUTPUT_TOKEN = 50;
export const SYNTHETIC_LATENCY_MIN_MS = 200;

/**
 * Fleet catalog of SOTA candidates. Costs are aligned with
 * `getPricingForModel()` in `src/shared/constants/pricing.ts` (per-1K
 * tokens, converted from the catalog's per-1M-token rate). Quality
 * scores reflect the public tier tables and arena ELO (Jan 2026
 * snapshot — refresh quarterly).
 */
export const DEFAULT_CANDIDATES: ReadonlyArray<Candidate> = [
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet",
    vendor: "Anthropic",
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    avgLatencyMs: 1200,
    qualityScore: 0.92,
    capabilities: new Set(["tools", "json_mode", "streaming", "vision"]),
    available: true,
  },
  {
    providerId: "openai",
    modelId: "gpt-4o",
    vendor: "OpenAI",
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    avgLatencyMs: 800,
    qualityScore: 0.9,
    capabilities: new Set(["tools", "json_mode", "streaming", "vision"]),
    available: true,
  },
  {
    providerId: "google",
    modelId: "gemini-1.5-pro",
    vendor: "Google",
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
    avgLatencyMs: 1000,
    qualityScore: 0.86,
    capabilities: new Set(["tools", "streaming", "vision"]),
    available: true,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-haiku",
    vendor: "Anthropic",
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
    avgLatencyMs: 500,
    qualityScore: 0.7,
    capabilities: new Set(["tools", "streaming"]),
    available: true,
  },
  {
    providerId: "openai",
    modelId: "gpt-4o-mini",
    vendor: "OpenAI",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    avgLatencyMs: 400,
    qualityScore: 0.72,
    capabilities: new Set(["tools", "json_mode", "streaming"]),
    available: true,
  },
  {
    providerId: "google",
    modelId: "gemini-1.5-flash",
    vendor: "Google",
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
    avgLatencyMs: 350,
    qualityScore: 0.68,
    capabilities: new Set(["streaming"]),
    available: true,
  },
];

// ─────────────────────────────────────────────────────────────────────
// Helpers — exported for testability + downstream composition
// ─────────────────────────────────────────────────────────────────────

/**
 * Estimate input tokens for a prompt using a 4-chars-per-token heuristic.
 * Returns 0 for an empty prompt so callers can detect "no input".
 */
export function estimateTokensFromPrompt(prompt: string): number {
  if (!prompt || prompt.length === 0) return 0;
  // Round up so a 1-4 char non-empty prompt is at least 1 token — this
  // matches tiktoken's behaviour for tiny inputs and is consistent with
  // the costAnalysis skill's heuristic.
  return Math.max(1, Math.ceil(prompt.length / CHARS_PER_TOKEN));
}

/**
 * Synthetic latency for a candidate that has no measured history:
 * 50ms per output token, with a 200ms floor. Used to keep the score
 * matrix finite when the caller has supplied a `Candidate` with
 * `avgLatencyMs: 0` (i.e. "unknown" sentinel).
 */
export function syntheticLatencyMs(outputTokens: number): number {
  return Math.max(
    SYNTHETIC_LATENCY_MIN_MS,
    outputTokens * SYNTHETIC_LATENCY_MS_PER_OUTPUT_TOKEN,
  );
}

/**
 * Projected cost in USD for a candidate given an input/output token
 * budget. Costs are $ per 1K tokens.
 */
export function estimateCostForCandidate(
  candidate: Candidate,
  inputTokens: number,
  outputTokens: number,
): number {
  const inputCost = (Math.max(0, inputTokens) / 1000) * candidate.costPer1kInput;
  const outputCost = (Math.max(0, outputTokens) / 1000) * candidate.costPer1kOutput;
  return inputCost + outputCost;
}

/**
 * Resolve the effective input/output token budget for a request,
 * applying the prompt-length estimator for input when the caller has
 * not supplied it explicitly. Output defaults to 800 tokens — a
 * conservative safety margin that matches the typical LLM response.
 */
export function resolveTokenBudget(request: SmartRoutingRequest): {
  inputTokens: number;
  outputTokens: number;
} {
  const inputTokens =
    typeof request.tokens_in === "number" && request.tokens_in >= 0
      ? request.tokens_in
      : estimateTokensFromPrompt(request.prompt);
  const outputTokens =
    typeof request.tokens_out === "number" && request.tokens_out >= 0
      ? request.tokens_out
      : DEFAULT_OUTPUT_TOKENS;
  return { inputTokens, outputTokens };
}

// ─────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────

export interface ScoreCandidatesResult {
  scored: ScoredCandidate[];
  rubric: Rubric;
}

/**
 * Score every candidate against the request, marking disqualified ones
 * (unavailable / excluded / missing capabilities) with `score: 0`. The
 * returned `scored` array preserves the input order; callers that want
 * a ranking should sort by `score` descending.
 */
export function scoreCandidates(
  request: SmartRoutingRequest,
  candidates: ReadonlyArray<Candidate>,
): ScoreCandidatesResult {
  const { inputTokens, outputTokens } = resolveTokenBudget(request);
  const excluded = new Set(request.excluded_providers ?? []);
  const preferred = new Set(request.preferred_providers ?? []);
  const required = request.required_capabilities ?? [];
  const weights = STRATEGY_WEIGHTS[request.strategy_hint ?? "balanced"];

  // Pass 1: project cost + latency for every candidate and mark
  // disqualifications. We do this on the full set so the cost range
  // normalization below uses the full cohort (not just the viable
  // subset) — this keeps the rubric honest about what the caller
  // actually had on the table.
  const projected = candidates.map((c) => {
    const cost = estimateCostForCandidate(c, inputTokens, outputTokens);
    const latency =
      c.avgLatencyMs > 0 ? c.avgLatencyMs : syntheticLatencyMs(outputTokens);

    let disqualified = false;
    let reason: ScoredCandidate["reason"] = null;
    let missing: string[] = [];

    if (!c.available) {
      disqualified = true;
      reason = "unavailable";
    } else if (excluded.has(c.providerId)) {
      disqualified = true;
      reason = "excluded";
    } else if (required.length > 0) {
      missing = required.filter((cap) => !c.capabilities.has(cap));
      if (missing.length > 0) {
        disqualified = true;
        reason = "missing_capabilities";
      }
    }

    return {
      candidate: c,
      cost,
      latency,
      disqualified,
      reason,
      missing,
      preferred: preferred.has(c.providerId),
    };
  });

  // Pass 2: normalize across the *viable* cohort. Disqualified entries
  // get 0 on every axis (and thus a score of 0).
  const viable = projected.filter((p) => !p.disqualified);
  const costs = viable.map((p) => p.cost);
  const latencies = viable.map((p) => p.latency);

  const minCost = costs.length > 0 ? Math.min(...costs) : 0;
  const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
  const minLat = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLat = latencies.length > 0 ? Math.max(...latencies) : 0;

  const safeNorm = (value: number, min: number, max: number): number => {
    if (!Number.isFinite(value) || max <= min) return 1;
    const t = (value - min) / (max - min);
    if (!Number.isFinite(t)) return 1;
    return Math.max(0, Math.min(1, t));
  };

  // Invert cost and latency so "higher = better" is consistent across
  // all four axes (cheaper wins, faster wins).
  const normCost = (cost: number): number => 1 - safeNorm(cost, minCost, maxCost);
  const normLat = (lat: number): number => 1 - safeNorm(lat, minLat, maxLat);

  const scored: ScoredCandidate[] = projected.map((p) => {
    if (p.disqualified) {
      return {
        providerId: p.candidate.providerId,
        modelId: p.candidate.modelId,
        vendor: p.candidate.vendor,
        estimatedCostUsd: p.cost,
        estimatedLatencyMs: p.latency,
        qualityScore: p.candidate.qualityScore,
        costNorm: 0,
        latencyNorm: 0,
        qualityNorm: 0,
        preferenceNorm: 0,
        score: 0,
        disqualified: true,
        reason: p.reason,
        missingCapabilities: p.missing,
      };
    }
    const costN = normCost(p.cost);
    const latN = normLat(p.latency);
    const qualN = safeNorm(p.candidate.qualityScore, 0, 1);
    const prefN = p.preferred ? 1 : 0;

    const score =
      weights.cost * costN +
      weights.latency * latN +
      weights.quality * qualN +
      weights.preference * prefN;

    return {
      providerId: p.candidate.providerId,
      modelId: p.candidate.modelId,
      vendor: p.candidate.vendor,
      estimatedCostUsd: p.cost,
      estimatedLatencyMs: p.latency,
      qualityScore: p.candidate.qualityScore,
      costNorm: costN,
      latencyNorm: latN,
      qualityNorm: qualN,
      preferenceNorm: prefN,
      score,
      disqualified: false,
      reason: null,
      missingCapabilities: [],
    };
  });

  const rubric: Rubric = {
    weights,
    candidatesEvaluated: candidates.length,
    candidatesDisqualified: candidates.length - viable.length,
  };

  return { scored, rubric };
}

// ─────────────────────────────────────────────────────────────────────
// Decision
// ─────────────────────────────────────────────────────────────────────

export interface PickBestResult {
  chosen: ChosenCandidate | null;
  runnerUp: RunnerUpCandidate[];
  recommendation: Recommendation;
  reason: DecisionReason;
  warnings: string[];
}

const RUNNER_UP_CAP = 3;

/**
 * Pick the best candidate from a scored cohort. If `maxCostUsd` is set
 * and every viable candidate exceeds it, the decision flips to
 * `reject` with reason `exceeds_max_cost` (and a warning that names
 * the cheapest available option as a hint to the caller).
 */
export function pickBest(
  scored: ReadonlyArray<ScoredCandidate>,
  rubric: Rubric,
  maxCostUsd?: number,
): PickBestResult {
  const viable = scored.filter((s) => !s.disqualified);

  if (viable.length === 0) {
    return {
      chosen: null,
      runnerUp: [],
      recommendation: "reject",
      reason: rubric.candidatesEvaluated > 0 ? "all_disqualified" : "no_candidates",
      warnings: [
        rubric.candidatesEvaluated > 0
          ? "All candidates were disqualified; widen constraints (drop excluded_providers / required_capabilities) or supply more candidates."
          : "No candidates supplied; nothing to route to.",
      ],
    };
  }

  // Sort viable by score descending; tie-break on cost (cheaper wins),
  // then on latency (faster wins), then lexicographically on
  // (providerId, modelId) for determinism.
  const sorted = [...viable].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.estimatedCostUsd !== b.estimatedCostUsd) {
      return a.estimatedCostUsd - b.estimatedCostUsd;
    }
    if (a.estimatedLatencyMs !== b.estimatedLatencyMs) {
      return a.estimatedLatencyMs - b.estimatedLatencyMs;
    }
    const keyA = `${a.providerId}/${a.modelId}`;
    const keyB = `${b.providerId}/${b.modelId}`;
    return keyA.localeCompare(keyB);
  });

  // Budget gate — if set, restrict the cohort to candidates that fit.
  if (typeof maxCostUsd === "number" && Number.isFinite(maxCostUsd)) {
    const within = sorted.filter((s) => s.estimatedCostUsd <= maxCostUsd);
    if (within.length === 0) {
      // The warning should name the *actual cheapest* viable option, not
      // the top-scored one (which may be the most expensive — e.g. when
      // strategy_hint="quality" the top-scored candidate is Opus-class).
      const cheapest = [...sorted].sort(
        (a, b) => a.estimatedCostUsd - b.estimatedCostUsd,
      )[0];
      return {
        chosen: null,
        runnerUp: [],
        recommendation: "reject",
        reason: "exceeds_max_cost",
        warnings: [
          `All ${sorted.length} viable candidate(s) exceed max_cost_usd=$${maxCostUsd.toFixed(6)}; cheapest available is ${cheapest.providerId}/${cheapest.modelId} at $${cheapest.estimatedCostUsd.toFixed(6)}.`,
        ],
      };
    }
    return finalize(within);
  }

  return finalize(sorted);
}

function finalize(sorted: ScoredCandidate[]): PickBestResult {
  const top = sorted[0];
  const chosen: ChosenCandidate = {
    providerId: top.providerId,
    modelId: top.modelId,
    vendor: top.vendor,
    estimatedCostUsd: top.estimatedCostUsd,
    estimatedLatencyMs: top.estimatedLatencyMs,
    qualityScore: top.qualityScore,
    score: top.score,
  };
  const runnerUp: RunnerUpCandidate[] = sorted
    .slice(1, 1 + RUNNER_UP_CAP)
    .map((s) => ({
      providerId: s.providerId,
      modelId: s.modelId,
      vendor: s.vendor,
      estimatedCostUsd: s.estimatedCostUsd,
      estimatedLatencyMs: s.estimatedLatencyMs,
      qualityScore: s.qualityScore,
      score: s.score,
      reason: `score=${s.score.toFixed(3)} (Δ=${(top.score - s.score).toFixed(3)} below chosen ${top.providerId}/${top.modelId})`,
    }));

  return {
    chosen,
    runnerUp,
    recommendation: "route",
    reason: "ok",
    warnings: [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Top-level ranking entry point. Resolves the candidate list (using
 * DEFAULT_CANDIDATES when the request omits it), scores, and picks the
 * best fit. Returns a structured decision — caller decides how to
 * surface it.
 */
export function rankCandidates(
  request: SmartRoutingRequest,
): SmartRoutingResult {
  const candidates = request.candidates ?? Array.from(DEFAULT_CANDIDATES);
  const { scored, rubric } = scoreCandidates(request, candidates);
  const pick = pickBest(scored, rubric, request.max_cost_usd);
  return {
    chosen: pick.chosen,
    runnerUp: pick.runnerUp,
    recommendation: pick.recommendation,
    reason: pick.reason,
    rubric,
    warnings: pick.warnings,
  };
}

/**
 * A2A entry point. Reads routing inputs from `task.metadata` and emits
 * a JSON artifact with the routing decision plus execution metadata
 * (strategy hint, tokens estimated, cohort size, warnings).
 */
export async function executeSmartRouting(task: A2ATask): Promise<A2ASkillResult> {
  const metadata = (task.metadata ?? {}) as Record<string, unknown>;

  const prompt =
    typeof metadata.prompt === "string" && metadata.prompt.length > 0
      ? (metadata.prompt as string)
      : null;

  if (prompt === null) {
    return {
      artifacts: [
        {
          type: "text",
          content: JSON.stringify({
            error: "missing_metadata",
            message:
              "smart-routing requires task.metadata.prompt (non-empty string)",
          }),
        },
      ],
    };
  }

  const request: SmartRoutingRequest = {
    prompt,
    strategy_hint: isStrategyHint(metadata.strategy_hint)
      ? (metadata.strategy_hint as StrategyHint)
      : undefined,
    candidates: Array.isArray(metadata.candidates)
      ? (metadata.candidates as Candidate[])
      : undefined,
    max_cost_usd: readNumber(metadata.max_cost_usd),
    excluded_providers: readStringArray(metadata.excluded_providers),
    preferred_providers: readStringArray(metadata.preferred_providers),
    required_capabilities: readStringArray(metadata.required_capabilities),
    tokens_in: readNumber(metadata.tokens_in),
    tokens_out: readNumber(metadata.tokens_out),
  };

  const decision = rankCandidates(request);
  const { inputTokens } = resolveTokenBudget(request);

  return {
    artifacts: [
      {
        type: "text",
        content: JSON.stringify(decision),
      },
    ],
    metadata: {
      strategy_hint: request.strategy_hint ?? "balanced",
      tokens_estimated: inputTokens,
      candidates_evaluated: decision.rubric.candidatesEvaluated,
      candidates_disqualified: decision.rubric.candidatesDisqualified,
      recommendation: decision.recommendation,
      reason: decision.reason,
      chosen: decision.chosen
        ? {
            provider_id: decision.chosen.providerId,
            model_id: decision.chosen.modelId,
            score: decision.chosen.score,
          }
        : null,
      warnings: decision.warnings,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Type-narrowing helpers
// ─────────────────────────────────────────────────────────────────────

function isStrategyHint(v: unknown): v is StrategyHint {
  return v === "cost" || v === "speed" || v === "quality" || v === "balanced";
}

function readNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function readStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.filter((x): x is string => typeof x === "string");
  return arr.length > 0 ? arr : undefined;
}
