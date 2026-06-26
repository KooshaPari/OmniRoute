/**
 * Per-engine analytics rollups for compression runs.
 *
 * Aggregates the per-step CompressionStats produced by
 * applyStackedCompression into per-engine rollups suitable for the
 * /api/compression/analytics endpoint and the studio UI.
 *
 * Rollups are purely derived from the existing
 * CompressionStats.engineBreakdown field -- this module does NOT
 * mutate state and does NOT call out to I/O.
 */

export interface EngineAnalyticsInput {
  engineName: string;
  originalTokens: number;
  compressedTokens: number;
  elapsedMs: number;
  compressionRatio: number; // 0..1, fraction saved
  errors: number;
  invocations: number;
  costSavedUsd: number;
  cachedTokens: number;
}

export interface EngineAnalyticsRollup {
  engineName: string;
  totalInvocations: number;
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  totalSavedTokens: number;
  averageCompressionRatio: number;
  totalElapsedMs: number;
  averageElapsedMs: number;
  totalCostSavedUsd: number;
  totalCachedTokens: number;
  errorRate: number;
  throughputTokensPerSecond: number;
  status: 'healthy' | 'degraded' | 'broken';
}

const HEALTHY_RATIO_THRESHOLD = 0.10;
const HEALTHY_ERROR_RATE = 0.05;
const HEALTHY_THROUGHPUT = 1_000;

/**
 * Rollup a single engine's stats across N runs.
 */
export function rollupEngine(
  engineName: string,
  inputs: EngineAnalyticsInput[],
): EngineAnalyticsRollup {
  if (inputs.length === 0) {
    return {
      engineName,
      totalInvocations: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalSavedTokens: 0,
      averageCompressionRatio: 0,
      totalElapsedMs: 0,
      averageElapsedMs: 0,
      totalCostSavedUsd: 0,
      totalCachedTokens: 0,
      errorRate: 0,
      throughputTokensPerSecond: 0,
      status: 'broken',
    };
  }

  const totalInvocations = inputs.length;
  const totalOriginalTokens = sum(inputs, (i) => i.originalTokens);
  const totalCompressedTokens = sum(inputs, (i) => i.compressedTokens);
  const totalSavedTokens = totalOriginalTokens - totalCompressedTokens;
  const averageCompressionRatio =
    totalOriginalTokens > 0 ? totalSavedTokens / totalOriginalTokens : 0;
  const totalElapsedMs = sum(inputs, (i) => i.elapsedMs);
  const averageElapsedMs = totalElapsedMs / totalInvocations;
  const totalCostSavedUsd = sum(inputs, (i) => i.costSavedUsd);
  const totalCachedTokens = sum(inputs, (i) => i.cachedTokens);
  const totalErrors = sum(inputs, (i) => i.errors);
  const errorRate = totalErrors / totalInvocations;
  const throughputTokensPerSecond =
    totalElapsedMs > 0
      ? Math.round((totalOriginalTokens * 1000) / totalElapsedMs)
      : 0;

  const status = classifyStatus({
    errorRate,
    averageCompressionRatio,
    throughputTokensPerSecond,
  });

  return {
    engineName,
    totalInvocations,
    totalOriginalTokens,
    totalCompressedTokens,
    totalSavedTokens,
    averageCompressionRatio,
    totalElapsedMs,
    averageElapsedMs,
    totalCostSavedUsd,
    totalCachedTokens,
    errorRate,
    throughputTokensPerSecond,
    status,
  };
}

/**
 * Rollup all engines at once.
 */
export function rollupAllEngines(
  byEngine: Record<string, EngineAnalyticsInput[]>,
): EngineAnalyticsRollup[] {
  return Object.entries(byEngine).map(([engineName, inputs]) =>
    rollupEngine(engineName, inputs),
  );
}

function sum<T>(arr: T[], pick: (t: T) => number): number {
  let total = 0;
  for (const item of arr) total += pick(item);
  return total;
}

function classifyStatus(metrics: {
  errorRate: number;
  averageCompressionRatio: number;
  throughputTokensPerSecond: number;
}): EngineAnalyticsRollup['status'] {
  if (metrics.errorRate > HEALTHY_ERROR_RATE * 2) return 'broken';
  if (
    metrics.averageCompressionRatio < HEALTHY_RATIO_THRESHOLD &&
    metrics.throughputTokensPerSecond < HEALTHY_THROUGHPUT
  ) {
    return 'degraded';
  }
  return 'healthy';
}
