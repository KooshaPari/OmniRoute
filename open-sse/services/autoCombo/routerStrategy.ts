/**
 * RouterStrategy — Pluggable Routing Strategy System
 *
 * Inspired by ClawRouter commit 14c83c258 "refactor: extract routing into pluggable RouterStrategy system".
 * Provides a RouterStrategy interface and two built-in implementations:
 *   - RulesStrategy (default): wraps the existing 6-factor scoring engine
 *   - CostStrategy: always picks cheapest available model
 */

import type { ProviderCandidate, ScoredProvider } from "./scoring.ts";
import { scorePool } from "./scoring.ts";
import { getTaskFitness } from "./taskFitness.ts";
<<<<<<< Updated upstream
import { clamp01 } from "../../utils/number.ts";
import { rankBySpeed } from "./speedRanking.ts";
import type { SpeedCandidate } from "./speedRanking.ts";

export interface SlaRoutingPolicy {
  targetP95Ms?: number;
  maxErrorRate?: number;
  maxCostPer1MTokens?: number;
  hardConstraints?: boolean;
}
=======
>>>>>>> Stashed changes

export interface RoutingContext {
  taskType: string;
  requestHasTools?: boolean;
  requestHasVision?: boolean;
  estimatedInputTokens?: number;
  lastKnownGoodProvider?: string;
  lkgpEnabled?: boolean;
}

export interface RoutingDecision {
  provider: string;
  model: string;
  strategy: string;
  reason: string;
  candidatesConsidered: number;
  finalScore: number;
}

export interface RouterStrategy {
  readonly name: string;
  readonly description: string;
  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision;
}

// ── RulesStrategy: wraps 6-factor scoring engine ────────────────────────────

function toSpeedCandidate(c: ProviderCandidate): SpeedCandidate {
  return {
    // Identity
    provider: c.provider,
    model: c.model,
    // Resource state
    quotaRemaining: c.quotaRemaining,
    quotaTotal: c.quotaTotal,
    circuitBreakerState: c.circuitBreakerState,
    // Costs
    costPer1MTokens: c.costPer1MTokens,
    // Latency metrics
    p95LatencyMs: c.p95LatencyMs,
    avgTtftMs: c.avgTtftMs,
    avgE2ELatencyMs: c.avgE2ELatencyMs,
    avgTokensPerSecond: c.avgTokensPerSecond,
    latencyStdDev: c.latencyStdDev,
    // Reliability
    errorRate: c.errorRate,
    failureRate: c.failureRate,
    // Tier signals (forwarded so weights stay available for downstream tuning)
    accountTier: c.accountTier,
    quotaResetIntervalSecs: c.quotaResetIntervalSecs,
    contextAffinity: c.contextAffinity,
    resetWindowAffinity: c.resetWindowAffinity,
    connectionPoolSize: c.connectionPoolSize,
    connectionId: c.connectionId,
  };
}

class RulesStrategyImpl implements RouterStrategy {
  readonly name = "rules";
  readonly description =
    "6-factor weighted scoring: quota, health, cost, latency, taskFit, stability";

  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision {
    const eligible = pool.filter((c) => c.circuitBreakerState !== "OPEN");
    const ranked: ScoredProvider[] = scorePool(
      eligible.length > 0 ? eligible : pool,
      context.taskType,
      undefined,
      getTaskFitness
    );
    const best = ranked[0];
    if (!best) throw new Error("[RulesStrategy] No candidates to score");
    return {
      provider: best.provider,
      model: best.model,
      strategy: this.name,
      reason: `RulesStrategy: score=${best.score.toFixed(3)} (quota=${best.factors.quota.toFixed(2)}, health=${best.factors.health.toFixed(2)}, cost=${best.factors.costInv.toFixed(2)}, taskFit=${best.factors.taskFit.toFixed(2)})`,
      candidatesConsidered: ranked.length,
      finalScore: best.score,
    };
  }
}

// ── CostStrategy: always picks cheapest healthy provider ─────────────────────

class CostStrategyImpl implements RouterStrategy {
  readonly name = "cost";
  readonly description = "Always selects cheapest available provider (by costPer1MTokens)";

  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision {
    const healthy = pool.filter((c) => c.circuitBreakerState !== "OPEN");
    const candidates = healthy.length > 0 ? healthy : pool;
    const sorted = [...candidates].sort((a, b) => a.costPer1MTokens - b.costPer1MTokens);
    const best = sorted[0];
    if (!best) throw new Error("[CostStrategy] No candidates available");
    return {
      provider: best.provider,
      model: best.model,
      strategy: this.name,
      reason: `CostStrategy: cheapest at $${best.costPer1MTokens.toFixed(3)}/1M tokens`,
      candidatesConsidered: candidates.length,
      finalScore: best.costPer1MTokens === 0 ? 1.0 : 1 / best.costPer1MTokens,
    };
  }
}

// ── LatencyStrategy: prioritize low latency + reliability ───────────────────

class LatencyStrategyImpl implements RouterStrategy {
  readonly name = "latency";
  readonly description =
    "Prioritizes the fastest reliable provider-model pair using TTFT, TPS, E2E latency, health, fail rate, and stability";

  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision {
    const ranked = rankBySpeed(pool.map(toSpeedCandidate));
    const winner = ranked[0];
    if (!winner) {
      throw new Error("[LatencyStrategy] No candidates available after speed ranking");
    }

    const w = winner;
    const wMetrics = winner.metrics;
    return {
      provider: w.provider,
      model: w.model,
      strategy: this.name,
      reason:
        `LatencyStrategy(score=${winner.score.toFixed(3)}): ` +
        `ttft=${wMetrics.avgTtftMs?.toFixed(0) ?? "n/a"}ms ` +
        `tps=${wMetrics.avgTokensPerSecond?.toFixed(1) ?? "n/a"} ` +
        `e2e=${wMetrics.avgE2ELatencyMs?.toFixed(0) ?? wMetrics.p95LatencyMs?.toFixed(0) ?? "n/a"}ms ` +
        `p95=${wMetrics.p95LatencyMs?.toFixed(0) ?? "n/a"}ms ` +
        `failRate=${((wMetrics.failureRate ?? 0) * 100).toFixed(2)}% ` +
        `stability=${wMetrics.latencyStdDev?.toFixed(0) ?? "n/a"}ms ` +
        `cb=${wMetrics.circuitBreakerState ?? "n/a"}`,
      candidatesConsidered: ranked.length,
      finalScore: winner.score,
    };
  }
}

// ── LKGPStrategy: tries last known good provider first ───────────────────────

class LKGPStrategyImpl implements RouterStrategy {
  readonly name = "lkgp";
  readonly description = "Tries last known good provider first, then falls back to rules";

  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision {
    if (context.lkgpEnabled === false) {
      return getStrategy("rules").select(pool, context);
    }

    if (context.lastKnownGoodProvider) {
      const best = pool.find(
        (c) => c.provider === context.lastKnownGoodProvider && c.circuitBreakerState !== "OPEN"
      );
      if (best) {
        return {
          provider: best.provider,
          model: best.model,
          strategy: this.name,
          reason: `LKGP: using last known good provider ${best.provider}`,
          candidatesConsidered: 1,
          finalScore: 1.0,
        };
      }
    }

    // Fallback to rules strategy
    return getStrategy("rules").select(pool, context);
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

const strategyRegistry = new Map<string, RouterStrategy>();

const rulesStrategy = new RulesStrategyImpl();
const costStrategy = new CostStrategyImpl();
const latencyStrategy = new LatencyStrategyImpl();
const lkgpStrategy = new LKGPStrategyImpl();

strategyRegistry.set("rules", rulesStrategy);
strategyRegistry.set("cost", costStrategy);
strategyRegistry.set("eco", costStrategy); // alias
strategyRegistry.set("latency", latencyStrategy);
strategyRegistry.set("fast", latencyStrategy); // alias
strategyRegistry.set("lkgp", lkgpStrategy);

export function getStrategy(name: string): RouterStrategy {
  const strategy = strategyRegistry.get(name);
  if (!strategy) {
    console.warn(`[RouterStrategy] Strategy '${name}' not found, falling back to 'rules'`);
    return rulesStrategy;
  }
  return strategy;
}

export function registerStrategy(name: string, strategy: RouterStrategy): void {
  if (strategyRegistry.has(name)) {
    console.warn(`[RouterStrategy] Overwriting strategy '${name}'`);
  }
  strategyRegistry.set(name, strategy);
}

export function listStrategies(): Array<{ name: string; description: string }> {
  return [...strategyRegistry.entries()].map(([name, s]) => ({ name, description: s.description }));
}

export function selectWithStrategy(
  pool: ProviderCandidate[],
  context: RoutingContext,
  strategyName = "rules"
): RoutingDecision {
  return getStrategy(strategyName).select(pool, context);
}
