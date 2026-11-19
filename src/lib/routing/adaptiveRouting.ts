import type { ProviderFailure } from "@/lib/resilience/failureClassification";
import type { ProviderQuotaStatus } from "@/lib/quota/providerQuotaTelemetry";

export type AllocationDecision = "allow" | "warn" | "deny";
export type CircuitState = "closed" | "open" | "half_open";

export interface RoutingCandidate {
  providerId: string;
  modelId: string;
  capabilityScore: number;
  allocation: AllocationDecision;
  healthScore: number;
  circuit: CircuitState;
  quota: ProviderQuotaStatus;
  latencyMs?: number;
  errorRate?: number;
  modelPreference?: number;
  costPreference?: number;
}

export interface RoutingExplanation {
  providerId: string;
  modelId: string;
  score: number;
  eligible: boolean;
  reasons: string[];
  factors: Record<string, number | string>;
}

export interface RankedRoutingResult {
  selected: RoutingExplanation | null;
  candidates: RoutingExplanation[];
}

function clamp(value: number | undefined, fallback = 0): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function quotaFactor(quota: ProviderQuotaStatus): number {
  switch (quota) {
    case "exhausted":
      return 0;
    case "approaching_limit":
      return 0.65;
    case "unavailable":
      return 0.9;
    case "unknown":
      return 1;
    case "healthy":
      return 1;
    default:
      return 1;
  }
}

function latencyFactor(latencyMs?: number): number {
  if (!Number.isFinite(latencyMs) || latencyMs === undefined) return 1;
  return Math.max(0.4, 1 - Math.min(latencyMs, 30_000) / 50_000);
}

export function scoreCandidate(candidate: RoutingCandidate): RoutingExplanation {
  const capability = clamp(candidate.capabilityScore);
  const allocation =
    candidate.allocation === "deny" ? 0 : candidate.allocation === "warn" ? 0.85 : 1;
  const health = clamp(candidate.healthScore, 0.5);
  const reliability = 1 - clamp(candidate.errorRate ?? 0);
  const latency = latencyFactor(candidate.latencyMs);
  const preference = clamp(candidate.modelPreference, 0.5);
  const cost = clamp(candidate.costPreference, 1);
  const quota = quotaFactor(candidate.quota);
  const circuit = candidate.circuit === "open" ? 0 : candidate.circuit === "half_open" ? 0.5 : 1;
  const score = Number(
    (
      capability *
      allocation *
      health *
      reliability *
      latency *
      preference *
      cost *
      quota *
      circuit
    ).toFixed(6)
  );
  const reasons = [
    capability >= 0.8 ? "capability match" : "partial capability match",
    candidate.allocation === "allow"
      ? "allocation permitted"
      : candidate.allocation === "warn"
        ? "allocation permitted with warning"
        : "allocation denied",
    health >= 0.8 ? "provider healthy" : "provider health degraded",
    `circuit ${candidate.circuit}`,
    candidate.quota === "unknown"
      ? "quota state unknown but not exhausted"
      : `quota ${candidate.quota}`,
  ];
  if (candidate.latencyMs !== undefined)
    reasons.push(`latency ${Math.round(candidate.latencyMs)}ms`);
  if (candidate.errorRate !== undefined)
    reasons.push(`${Math.round(candidate.errorRate * 100)}% recent errors`);
  return {
    providerId: candidate.providerId,
    modelId: candidate.modelId,
    score,
    eligible:
      score > 0 &&
      candidate.allocation !== "deny" &&
      candidate.circuit !== "open" &&
      candidate.quota !== "exhausted",
    reasons,
    factors: {
      capability,
      allocation,
      health,
      reliability,
      latency,
      preference,
      cost,
      quota,
      circuit,
    },
  };
}

export function rankCandidates(candidates: RoutingCandidate[]): RankedRoutingResult {
  const ranked = candidates.map(scoreCandidate).sort((a, b) => b.score - a.score);
  return { selected: ranked.find((candidate) => candidate.eligible) ?? null, candidates: ranked };
}

export type ParetoPreference = "balanced" | "quality" | "cost" | "latency";

export interface ParetoRankedResult extends RankedRoutingResult {
  frontier: RoutingExplanation[];
}

interface ParetoEntry {
  explanation: RoutingExplanation;
  quality: number;
  cost: number;
  latency: number;
}

function toParetoEntry(candidate: RoutingCandidate): ParetoEntry {
  const explanation = scoreCandidate(candidate);
  const factors = explanation.factors as Record<string, number>;
  return {
    explanation,
    quality: factors.capability * factors.health * factors.reliability * factors.preference,
    cost: 1 - factors.cost,
    latency: 1 - factors.latency,
  };
}

function dominates(left: ParetoEntry, right: ParetoEntry): boolean {
  const noWorse =
    left.quality >= right.quality && left.cost <= right.cost && left.latency <= right.latency;
  const strictlyBetter =
    left.quality > right.quality || left.cost < right.cost || left.latency < right.latency;
  return noWorse && strictlyBetter;
}

function paretoEntries(candidates: RoutingCandidate[]): ParetoEntry[] {
  const eligible = candidates.map(toParetoEntry).filter((entry) => entry.explanation.eligible);
  return eligible
    .filter((entry) => !eligible.some((other) => other !== entry && dominates(other, entry)))
    .sort((a, b) => b.quality - a.quality || a.cost - b.cost);
}

export function paretoFrontier(candidates: RoutingCandidate[]): RoutingExplanation[] {
  return paretoEntries(candidates).map((entry) => entry.explanation);
}

function normalize(value: number, min: number, max: number, invert = false): number {
  if (max <= min) return 1;
  const ratio = (value - min) / (max - min);
  return invert ? 1 - ratio : ratio;
}

export function rankCandidatesPareto(
  candidates: RoutingCandidate[],
  preference: ParetoPreference = "balanced"
): ParetoRankedResult {
  const ranked = candidates.map(scoreCandidate).sort((a, b) => b.score - a.score);
  const frontier = paretoEntries(candidates);

  if (frontier.length === 0) {
    return { selected: null, candidates: ranked, frontier: [] };
  }

  let selected: ParetoEntry;
  if (preference === "quality") {
    selected = [...frontier].sort(
      (a, b) => b.quality - a.quality || b.explanation.score - a.explanation.score
    )[0];
  } else if (preference === "cost") {
    selected = [...frontier].sort(
      (a, b) =>
        a.cost - b.cost || b.quality - a.quality || b.explanation.score - a.explanation.score
    )[0];
  } else if (preference === "latency") {
    selected = [...frontier].sort(
      (a, b) =>
        a.latency - b.latency || b.quality - a.quality || b.explanation.score - a.explanation.score
    )[0];
  } else {
    const qualities = frontier.map((entry) => entry.quality);
    const costs = frontier.map((entry) => entry.cost);
    const latencies = frontier.map((entry) => entry.latency);
    const [minQ, maxQ] = [Math.min(...qualities), Math.max(...qualities)];
    const [minC, maxC] = [Math.min(...costs), Math.max(...costs)];
    const [minL, maxL] = [Math.min(...latencies), Math.max(...latencies)];
    selected = [...frontier].sort((a, b) => {
      const scoreA =
        0.5 * normalize(a.quality, minQ, maxQ) +
        0.25 * normalize(a.cost, minC, maxC, true) +
        0.25 * normalize(a.latency, minL, maxL, true);
      const scoreB =
        0.5 * normalize(b.quality, minQ, maxQ) +
        0.25 * normalize(b.cost, minC, maxC, true) +
        0.25 * normalize(b.latency, minL, maxL, true);
      return scoreB - scoreA || b.explanation.score - a.explanation.score;
    })[0];
  }

  return {
    selected: selected.explanation,
    candidates: ranked,
    frontier: frontier.map((entry) => entry.explanation),
  };
}

export interface FailoverPolicy {
  maxProviderAttempts: number;
  allowCrossProviderFallback: boolean;
  retryRateLimited: boolean;
  retryTimeouts: boolean;
}

export const DEFAULT_FAILOVER_POLICY: FailoverPolicy = {
  maxProviderAttempts: 3,
  allowCrossProviderFallback: true,
  retryRateLimited: true,
  retryTimeouts: true,
};

export function shouldFailover(
  failure: ProviderFailure,
  policy = DEFAULT_FAILOVER_POLICY
): boolean {
  if (!policy.allowCrossProviderFallback || !failure.retryable) return false;
  if (failure.type === "rate_limit") return policy.retryRateLimited;
  if (failure.type === "timeout") return policy.retryTimeouts;
  return failure.type === "network_error" || failure.type === "provider_5xx";
}
