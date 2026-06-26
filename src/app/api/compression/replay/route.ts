/**
 * GET /api/compression/replay?id=<runId>
 *
 * Returns a single run record by id, used by the studio UI's
 * "replay" panel to rehydrate a previous compression's stats.
 */
import { NextResponse } from 'next/server';
import { getRunHistoryBuffer } from '@omniroute/open-sse/services/compression/runHistory.ts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'Missing required query parameter: id' },
      { status: 400 },
    );
  }
  const buffer = getRunHistoryBuffer();
  const record = buffer.get(id);
  if (!record) {
    return NextResponse.json(
      { error: `No run with id ${id}` },
      { status: 404 },
    );
  }
  return NextResponse.json(record);
}
