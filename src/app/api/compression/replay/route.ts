/**
 * GET /api/compression/replay
 *
 * Returns the recent compression run history so the dashboard can render a
 * "replay" panel alongside the live `compression.completed` event in
 * `open-sse/services/compression/engineBreakdown.ts`.
 *
 * Query parameters (all optional, case-sensitive except `provider`):
 *   - `provider`  Exact (case-insensitive) match on `provider` column.
 *                 Example: `?provider=openai`.
 *   - `model`     Best-effort filter on the originating model. The
 *                 `compression_analytics` table does not store `model`
 *                 directly, so this matches against `request_id LIKE`.
 *                 Example: `?model=gpt-4o-mini`.
 *   - `windowMs`  How far back to look, in milliseconds from `now`.
 *                 Clamped to [1, 30 days]. Default 24h.
 *                 Example: `?windowMs=300000` (last 5 minutes).
 *   - `limit`     Max rows to return. Clamped to [1, 1000]. Default 100.
 *
 * Response:
 *   {
 *     runs:        Array<run>,
 *     count:       number,
 *     filters:     { provider, model, windowMs, limit },
 *     windowStart: ISO string,
 *     now:         ISO string
 *   }
 *
 * Each run mirrors the relevant columns from `compression_analytics` plus
 * the per-engine breakdown rows (if any) for the same `request_id`, so the
 * studio can switch from the live event to historical detail without losing
 * the engine graph.
 *
 * Auth: requireManagementAuth. In the unconfigured/first-run state (no
 * INITIAL_PASSWORD) this is a no-op.
 */

import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  getRecentCompressionAnalyticsRuns,
  getCompressionEngineBreakdownForRequests,
} from "@/lib/db/compressionAnalytics";
import type { CompressionReplayRow } from "@/lib/db/compressionAnalytics";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { ensureEngineBreakdown } from "@omniroute/open-sse/services/compression/engineBreakdown";
import type { EngineBreakdownEntry } from "@omniroute/open-sse/services/compression/engineBreakdown";

/** Max lookback the `windowMs` query param will accept (30 days). */
const WINDOW_MS_MAX = 30 * 24 * 60 * 60 * 1000;
/** Default lookback if `windowMs` is not supplied (24 hours). */
const WINDOW_MS_DEFAULT = 24 * 60 * 60 * 1000;
/** Default row cap when `limit` is not supplied. */
const LIMIT_DEFAULT = 100;
/** Hard ceiling for `limit`. */
const LIMIT_MAX = 1000;

function parseWindowMs(raw: string | null): number {
  if (raw === null) return WINDOW_MS_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return WINDOW_MS_DEFAULT;
  return Math.min(WINDOW_MS_MAX, Math.floor(n));
}

function parseLimit(raw: string | null): number {
  if (raw === null) return LIMIT_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return LIMIT_DEFAULT;
  return Math.min(LIMIT_MAX, Math.floor(n));
}

function cleanString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

interface ReplayRunResponse {
  id: number;
  timestamp: string;
  mode: string;
  engine: string | null;
  provider: string | null;
  modelHint: string | null;
  comboId: string | null;
  compressionComboId: string | null;
  requestId: string | null;
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  savingsPercent: number;
  durationMs: number | null;
  validationFallback: boolean;
  receiptSource: string | null;
  estimatedUsdSaved: number | null;
  actualTotalTokens: number | null;
  engineBreakdown: EngineBreakdownEntry[];
}

/**
 * Compute the model hint from a request_id fragment, if any.
 * request_ids frequently embed a model tag (e.g. `claude-3-5-sonnet:::req-…`).
 * Returns null if no plausible model token is present, so callers can still
 * distinguish "model unknown" from "model=gpt-4o".
 */
function extractModelHint(requestId: string | null | undefined): string | null {
  if (!requestId) return null;
  const head = requestId.split(":::")[0];
  const beforeUuid = head.split("::")[0];
  if (beforeUuid && beforeUuid.length > 0 && beforeUuid.length <= 128) {
    return beforeUuid;
  }
  return null;
}

/**
 * Read all per-engine breakdown rows for a list of request_ids via the DB helper.
 * Returns a Map keyed by request_id mapped to a list of `EngineBreakdownEntry`
 * shapes ready to embed in the replay response.
 */
function loadBreakdownForRequests(
  requestIds: Array<string | null | undefined>
): Map<string, EngineBreakdownEntry[]> {
  const raw = getCompressionEngineBreakdownForRequests(requestIds);
  const out = new Map<string, EngineBreakdownEntry[]>();
  for (const [requestId, rows] of raw.entries()) {
    out.set(
      requestId,
      rows.map((r) => ({
        engine: r.engine,
        originalTokens: r.original_tokens,
        compressedTokens: r.compressed_tokens,
        tokensSaved: r.tokens_saved,
        durationMs: r.duration_ms ?? undefined,
      }))
    );
  }
  return out;
}

function shapeRun(
  row: CompressionReplayRow,
  breakdown: EngineBreakdownEntry[]
): ReplayRunResponse {
  const originalTokens = Number(row.original_tokens) || 0;
  const compressedTokens = Number(row.compressed_tokens) || 0;
  const savingsPercent =
    originalTokens > 0
      ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 1000) / 10
      : 0;

  return {
    id: row.id,
    timestamp: row.timestamp,
    mode: row.mode,
    engine: row.engine ?? null,
    provider: row.provider ?? null,
    modelHint: extractModelHint(row.request_id),
    comboId: row.combo_id ?? row.compression_combo_id ?? null,
    compressionComboId: row.compression_combo_id ?? null,
    requestId: row.request_id ?? null,
    originalTokens,
    compressedTokens,
    tokensSaved: Number(row.tokens_saved) || 0,
    savingsPercent,
    durationMs: row.duration_ms ?? null,
    validationFallback: Boolean(row.validation_fallback),
    receiptSource: row.receipt_source ?? null,
    estimatedUsdSaved:
      row.estimated_usd_saved === null || row.estimated_usd_saved === undefined
        ? null
        : Number(row.estimated_usd_saved),
    actualTotalTokens:
      row.actual_total_tokens === null || row.actual_total_tokens === undefined
        ? null
        : Number(row.actual_total_tokens),
    engineBreakdown:
      breakdown.length > 0
        ? breakdown
        : ensureEngineBreakdown({
            engine: row.engine ?? undefined,
            mode: row.mode,
            originalTokens,
            compressedTokens,
            savingsPercent,
            techniquesUsed: [],
          }),
  };
}

export async function GET(req: Request) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const provider = cleanString(url.searchParams.get("provider"));
    const model = cleanString(url.searchParams.get("model"));
    const windowMs = parseWindowMs(url.searchParams.get("windowMs"));
    const limit = parseLimit(url.searchParams.get("limit"));

    const now = new Date();
    const sinceIso = new Date(now.getTime() - windowMs).toISOString();

    const rows = getRecentCompressionAnalyticsRuns({
      limit,
      sinceIso,
      provider,
      model,
    });

    const requestIds = rows.map((r) => r.request_id);
    const breakdownByRequestId = loadBreakdownForRequests(requestIds);

    const runs: ReplayRunResponse[] = rows.map((row) =>
      shapeRun(row, breakdownByRequestId.get(row.request_id ?? "") ?? [])
    );

    return NextResponse.json({
      runs,
      count: runs.length,
      filters: { provider, model, windowMs, limit },
      windowStart: sinceIso,
      now: now.toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/compression/replay]", msg);
    return NextResponse.json(
      { error: "Failed to load compression replay history", details: sanitizeErrorMessage(msg) },
      { status: 500 }
    );
  }
}
