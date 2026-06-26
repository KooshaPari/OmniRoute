/**
 * Top-level studio aggregator.
 *
 * Combines:
 *   - per-engine analytics (perEngineAnalytics)
 *   - projected UI rows (breakdownProjector)
 *   - savings radar (savingsRadar)
 *   - recent run history (runHistory)
 *
 * into a single snapshot for the /api/compression/studio endpoint.
 * Pure aggregator -- no I/O.
 */

import {
  rollupAllEngines,
  type EngineAnalyticsInput,
} from './perEngineAnalytics.ts';
import {
  projectBreakdown,
  type BreakdownMatrix,
} from './breakdownProjector.ts';
import { computeSavingsRadar, type SavingsRadar } from './savingsRadar.ts';
import {
  getRunHistoryBuffer,
  type CompressedRunRecord,
} from './runHistory.ts';

export interface StudioSnapshot {
  breakdown: BreakdownMatrix;
  radar: SavingsRadar;
  recentRuns: CompressedRunRecord[];
  summary: {
    totalEngines: number;
    totalRuns: number;
    totalSavedTokens: number;
    totalCostSavedUsd: number;
    healthScore: number;
    generatedAt: string;
  };
}

export interface StudioInputs {
  perEngineInputs: Record<string, EngineAnalyticsInput[]>;
  recentRunsLimit?: number;
}

export function aggregateStudio(inputs: StudioInputs): StudioSnapshot {
  const rollups = rollupAllEngines(inputs.perEngineInputs);
  const breakdown = projectBreakdown(rollups);
  const radar = computeSavingsRadar(rollups);
  const buffer = getRunHistoryBuffer();
  const recentRuns = buffer.list(inputs.recentRunsLimit ?? 50);

  const summary = {
    totalEngines: rollups.length,
    totalRuns: buffer.size(),
    totalSavedTokens: breakdown.totals.savedTokens,
    totalCostSavedUsd: breakdown.totals.costSavedUsd,
    healthScore: breakdown.healthScore,
    generatedAt: new Date().toISOString(),
  };

  return { breakdown, radar, recentRuns, summary };
}
