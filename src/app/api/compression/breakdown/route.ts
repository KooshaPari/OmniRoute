/**
 * GET /api/compression/breakdown
 *
 * Returns the per-engine / per-step breakdown matrix that drives the
 * compression studio UI's heatmap.  Pulls live stats from the
 * CompressionTelemetry singleton (wired in PR #109).
 */
import { NextResponse } from 'next/server';
import {
  rollupAllEngines,
  type EngineAnalyticsInput,
} from '@omniroute/open-sse/services/compression/perEngineAnalytics.ts';
import { projectBreakdown } from '@omniroute/open-sse/services/compression/breakdownProjector.ts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sinceMs = Number(url.searchParams.get('sinceMs') ?? 3600_000);

  const byEngine = collectPerEngineInputs(sinceMs);
  const rollups = rollupAllEngines(byEngine);
  const breakdown = projectBreakdown(rollups);

  return NextResponse.json(breakdown);
}

/**
 * Stand-in for telemetry data collection.  In a follow-up PR this
 * will read from the CompressionTelemetry singleton's recent-buffer
 * (see open-sse/services/compression/telemetry.ts).
 */
function collectPerEngineInputs(
  _sinceMs: number,
): Record<string, EngineAnalyticsInput[]> {
  return {};
}
