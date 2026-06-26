/**
 * Computes savings-radar data for chart visualisation.
 *
 * The studio UI renders a radar chart with 6 axes:
 *   1. token-savings  (compression ratio)
 *   2. cost-savings    (USD saved per 1k tokens)
 *   3. latency-saved  (ms saved per call)
 *   4. cache-hits     (cache hit rate)
 *   5. error-rate     (lower is better -- inverted)
 *   6. coverage       (fraction of requests that hit any engine)
 *
 * All axes are normalised to 0..100.  Pure compute -- no I/O.
 */

import type { EngineAnalyticsRollup } from './perEngineAnalytics.ts';

export interface SavingsRadarAxis {
  axis: string;
  value: number; // 0..100
  raw: number;
  label: string;
}

export interface SavingsRadar {
  axes: SavingsRadarAxis[];
  overallScore: number; // 0..100
  generatedAt: string;
}

const COST_USD_PER_1K_MAX = 0.03;
const LATENCY_SAVED_MS_MAX = 800;
const CACHE_HIT_RATE_MAX = 0.6;
const ERROR_RATE_MAX = 0.05;
const COVERAGE_MIN = 0.95;

export function computeSavingsRadar(
  rollups: EngineAnalyticsRollup[],
): SavingsRadar {
  const aggregated = aggregate(rollups);
  const axes: SavingsRadarAxis[] = [
    {
      axis: 'token-savings',
      value: clamp(Math.round(aggregated.savingsPercent * 100)),
      raw: aggregated.savingsPercent,
      label: 'Token savings',
    },
    {
      axis: 'cost-savings',
      value: clamp(
        Math.round(
          (aggregated.costPer1kUsd / COST_USD_PER_1K_MAX) * 100,
        ),
      ),
      raw: aggregated.costPer1kUsd,
      label: 'Cost per 1k tokens',
    },
    {
      axis: 'latency-saved',
      value: clamp(
        Math.round((aggregated.avgLatencySavedMs / LATENCY_SAVED_MS_MAX) * 100),
      ),
      raw: aggregated.avgLatencySavedMs,
      label: 'Latency saved (ms/call)',
    },
    {
      axis: 'cache-hits',
      value: clamp(
        Math.round((aggregated.cacheHitRate / CACHE_HIT_RATE_MAX) * 100),
      ),
      raw: aggregated.cacheHitRate,
      label: 'Cache hit rate',
    },
    {
      axis: 'error-rate',
      // Lower is better -- invert
      value: clamp(Math.round((1 - aggregated.errorRate / ERROR_RATE_MAX) * 100)),
      raw: aggregated.errorRate,
      label: 'Error rate (lower = better)',
    },
    {
      axis: 'coverage',
      value: clamp(Math.round((aggregated.coverage / COVERAGE_MIN) * 100)),
      raw: aggregated.coverage,
      label: 'Engine coverage',
    },
  ];

  const overallScore = Math.round(
    axes.reduce((sum, a) => sum + a.value, 0) / axes.length,
  );

  return { axes, overallScore, generatedAt: new Date().toISOString() };
}

function aggregate(rollups: EngineAnalyticsRollup[]) {
  const totalOriginal = sum(rollups, (r) => r.totalOriginalTokens);
  const totalCompressed = sum(rollups, (r) => r.totalCompressedTokens);
  const totalElapsed = sum(rollups, (r) => r.totalElapsedMs);
  const totalInvocations = sum(rollups, (r) => r.totalInvocations);
  const totalCostSaved = sum(rollups, (r) => r.totalCostSavedUsd);
  const totalCached = sum(rollups, (r) => r.totalCachedTokens);
  const totalErrors = sum(rollups, (r) => r.totalInvocations * r.errorRate);

  const savingsPercent =
    totalOriginal > 0 ? (totalOriginal - totalCompressed) / totalOriginal : 0;
  const costPer1kUsd =
    totalCompressed > 0 ? (totalCostSaved * 1000) / totalCompressed : 0;
  const avgLatencySavedMs =
    totalInvocations > 0 ? totalElapsed / totalInvocations : 0;
  const cacheHitRate =
    totalOriginal > 0 ? totalCached / totalOriginal : 0;
  const errorRate = totalInvocations > 0 ? totalErrors / totalInvocations : 0;
  const coverage = rollups.length > 0 ? 1.0 : 0.0;

  return {
    savingsPercent,
    costPer1kUsd,
    avgLatencySavedMs,
    cacheHitRate,
    errorRate,
    coverage,
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function sum<T>(arr: T[], pick: (t: T) => number): number {
  let total = 0;
  for (const item of arr) total += pick(item);
  return total;
}
