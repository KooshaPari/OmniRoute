/**
 * GET /api/compression/studio
 *
 * Returns the full studio snapshot (breakdown + radar + recent runs
 * + summary) in a single round-trip.  Powers the studio dashboard.
 */
import { NextResponse } from 'next/server';
import { aggregateStudio } from '@omniroute/open-sse/services/compression/studioAggregator.ts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const snapshot = aggregateStudio({
    perEngineInputs: {},
    recentRunsLimit: 50,
  });
  return NextResponse.json(snapshot);
}
