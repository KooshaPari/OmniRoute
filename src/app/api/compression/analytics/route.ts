/**
 * GET /api/compression/analytics
 *
 * Returns per-engine analytics rollups for the studio UI's
 * "engine leaderboard" panel.
 */
import { NextResponse } from 'next/server';
import { rollupAllEngines } from '@omniroute/open-sse/services/compression/perEngineAnalytics.ts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const rollups = rollupAllEngines({});
  return NextResponse.json({ engines: rollups });
}
