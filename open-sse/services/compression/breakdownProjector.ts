/**
 * Projects per-engine analytics into UI-ready rows.
 *
 * The /api/compression/breakdown endpoint serves a row-per-engine,
 * column-per-step matrix that the studio UI renders as a heatmap.
 * This module does the projection; it does NOT do I/O.
 */

import type { EngineAnalyticsRollup } from './perEngineAnalytics.ts';

export interface BreakdownRow {
  engineName: string;
  engineIndex: number;
  invocations: number;
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  savingsPercent: number;
  costSavedUsd: number;
  elapsedMs: number;
  throughputTokensPerSecond: number;
  status: EngineAnalyticsRollup['status'];
  health: 'good' | 'warning' | 'critical';
}

export interface BreakdownMatrix {
  rows: BreakdownRow[];
  totals: {
    originalTokens: number;
    compressedTokens: number;
    savedTokens: number;
    costSavedUsd: number;
    elapsedMs: number;
    invocations: number;
  };
  healthScore: number; // 0..100
  generatedAt: string;
}

/**
 * Project a list of per-engine rollups into UI rows + a totals row.
 */
export function projectBreakdown(
  rollups: EngineAnalyticsRollup[],
): BreakdownMatrix {
  const rows: BreakdownRow[] = rollups.map((r, i) => ({
    engineName: r.engineName,
    engineIndex: i,
    invocations: r.totalInvocations,
    originalTokens: r.totalOriginalTokens,
    compressedTokens: r.totalCompressedTokens,
    savedTokens: r.totalSavedTokens,
    savingsPercent: Math.round(r.averageCompressionRatio * 10000) / 100,
    costSavedUsd: r.totalCostSavedUsd,
    elapsedMs: r.totalElapsedMs,
    throughputTokensPerSecond: r.throughputTokensPerSecond,
    status: r.status,
    health: deriveHealth(r),
  }));

  const totals = {
    originalTokens: sum(rollups, (r) => r.totalOriginalTokens),
    compressedTokens: sum(rollups, (r) => r.totalCompressedTokens),
    savedTokens: sum(rollups, (r) => r.totalSavedTokens),
    costSavedUsd: sum(rollups, (r) => r.totalCostSavedUsd),
    elapsedMs: sum(rollups, (r) => r.totalElapsedMs),
    invocations: sum(rollups, (r) => r.totalInvocations),
  };

  const healthScore = computeHealthScore(rows);
  const generatedAt = new Date().toISOString();

  return { rows, totals, healthScore, generatedAt };
}

function deriveHealth(
  r: EngineAnalyticsRollup,
): BreakdownRow['health'] {
  if (r.status === 'broken') return 'critical';
  if (r.status === 'degraded') return 'warning';
  return 'good';
}

function computeHealthScore(rows: BreakdownRow[]): number {
  if (rows.length === 0) return 100;
  let score = 0;
  for (const row of rows) {
    if (row.health === 'good') score += 100;
    else if (row.health === 'warning') score += 50;
    else score += 0;
  }
  return Math.round(score / rows.length);
}

function sum<T>(arr: T[], pick: (t: T) => number): number {
  let total = 0;
  for (const item of arr) total += pick(item);
  return total;
}
