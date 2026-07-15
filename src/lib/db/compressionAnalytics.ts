import { getDbInstance } from "./core";

export interface CompressionAnalyticsRow {
  id?: number;
  timestamp: string;
  combo_id?: string | null;
  provider?: string | null;
  mode: string;
  original_tokens: number;
  compressed_tokens: number;
  tokens_saved: number;
  duration_ms?: number | null;
  request_id?: string | null;
<<<<<<< Updated upstream
  actual_prompt_tokens?: number | null;
  actual_completion_tokens?: number | null;
  actual_total_tokens?: number | null;
  actual_cache_read_tokens?: number | null;
  actual_cache_write_tokens?: number | null;
  estimated_usd_saved?: number | null;
  mcp_description_tokens_saved?: number | null;
  multimodal_skip_count?: number | null;
  receipt_source?: string | null;
  validation_fallback?: boolean | number | null;
  output_mode?: string | null;
  rtk_raw_output_pointer?: string | null;
  rtk_raw_output_bytes?: number | null;
  rtk_raw_output_pointers?: string | null;
  rtk_raw_output_total_bytes?: number | null;
  // Set on a no-op/skipped row: compression was attempted (mode active, engines
  // ran) but produced no recordable saving. NULL on a normal saving row. Lets
  // analytics distinguish "ran but saved nothing" from "never ran" (#4268).
  skip_reason?: string | null;
}

/**
 * One row per engine that ran inside a stacked compression pipeline. A stacked
 * request writes a single aggregate `compression_analytics` row (engine = mode) plus
 * N of these — so per-engine savings are queryable historically, not just live.
 */
export interface CompressionEngineBreakdownRow {
  timestamp: string;
  request_id?: string | null;
  engine: string;
  original_tokens: number;
  compressed_tokens: number;
  tokens_saved: number;
  duration_ms?: number | null;
=======
>>>>>>> Stashed changes
}

export interface CompressionAnalyticsSummary {
  totalRequests: number;
  totalTokensSaved: number;
  avgSavingsPct: number;
  avgDurationMs: number;
<<<<<<< Updated upstream
  // `count`/`tokensSaved`/`avgSavingsPct` cover net-saving runs only (skip rows
  // excluded), preserving historical semantics. `skipped` = attempted-but-no-op
  // runs for that mode, so Stacked is no longer invisible when it saves nothing (#4268).
  byMode: Record<
    string,
    { count: number; tokensSaved: number; avgSavingsPct: number; skipped: number }
  >;
  byEngine: Record<string, { count: number; tokensSaved: number; avgSavingsPct: number }>;
  byCompressionCombo: Record<string, { count: number; tokensSaved: number }>;
  byProvider: Record<string, { count: number; tokensSaved: number }>;
  last24h: Array<{ hour: string; count: number; tokensSaved: number }>;
  // Total attempted-but-no-op compression runs (skip_reason set), and a breakdown
  // by reason (e.g. "no_savings"). Recorded but excluded from the saving aggregates (#4268).
  totalSkipped: number;
  bySkipReason: Record<string, number>;
  validationFallbacks: number;
  realUsage: {
    requestsWithReceipts: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedUsdSaved: number;
    bySource: Record<string, number>;
  };
  mcpDescriptionCompression: {
    snapshots: number;
    estimatedTokensSaved: number;
  };
}

let columnsEnsuredForDb: unknown = null;

const COMPRESSION_ANALYTICS_COLUMNS = [
  ["actual_prompt_tokens", "INTEGER"],
  ["actual_completion_tokens", "INTEGER"],
  ["actual_total_tokens", "INTEGER"],
  ["actual_cache_read_tokens", "INTEGER"],
  ["actual_cache_write_tokens", "INTEGER"],
  ["estimated_usd_saved", "REAL"],
  ["mcp_description_tokens_saved", "INTEGER DEFAULT 0"],
  ["multimodal_skip_count", "INTEGER DEFAULT 0"],
  ["receipt_source", "TEXT"],
  ["validation_fallback", "INTEGER DEFAULT 0"],
  ["output_mode", "TEXT"],
  ["compression_combo_id", "TEXT"],
  ["engine", "TEXT"],
  ["rtk_raw_output_pointer", "TEXT"],
  ["rtk_raw_output_bytes", "INTEGER"],
  ["rtk_raw_output_pointers", "TEXT"],
  ["rtk_raw_output_total_bytes", "INTEGER"],
  ["skip_reason", "TEXT"],
] as const;

function ensureCompressionAnalyticsColumns(): void {
  const db = getDbInstance();
  if (columnsEnsuredForDb === db) return;
  const rows = db.prepare("PRAGMA table_info(compression_analytics)").all() as Array<{
    name: string;
  }>;
  const existing = new Set(rows.map((row) => row.name));
  for (const [name, type] of COMPRESSION_ANALYTICS_COLUMNS) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE compression_analytics ADD COLUMN ${name} ${type}`);
    }
  }
  columnsEnsuredForDb = db;
=======
  byMode: Record<string, { count: number; tokensSaved: number; avgSavingsPct: number }>;
  byProvider: Record<string, { count: number; tokensSaved: number }>;
  last24h: Array<{ hour: string; count: number; tokensSaved: number }>;
>>>>>>> Stashed changes
}

export function insertCompressionAnalyticsRow(row: CompressionAnalyticsRow): void {
  const db = getDbInstance();
  db.prepare(
    `
<<<<<<< Updated upstream
    INSERT INTO compression_analytics (
      timestamp, combo_id, compression_combo_id, engine, provider, mode, original_tokens, compressed_tokens, tokens_saved,
      duration_ms, request_id, actual_prompt_tokens, actual_completion_tokens,
      actual_total_tokens, actual_cache_read_tokens, actual_cache_write_tokens,
      estimated_usd_saved, mcp_description_tokens_saved, multimodal_skip_count,
      receipt_source, validation_fallback, output_mode, rtk_raw_output_pointer, rtk_raw_output_bytes,
      rtk_raw_output_pointers, rtk_raw_output_total_bytes, skip_reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
=======
    INSERT INTO compression_analytics (timestamp, combo_id, provider, mode, original_tokens, compressed_tokens, tokens_saved, duration_ms, request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
>>>>>>> Stashed changes
  `
  ).run(
    row.timestamp,
    row.combo_id ?? null,
    row.provider ?? null,
    row.mode,
    row.original_tokens,
    row.compressed_tokens,
    row.tokens_saved,
    row.duration_ms ?? null,
<<<<<<< Updated upstream
    row.request_id ?? null,
    row.actual_prompt_tokens ?? null,
    row.actual_completion_tokens ?? null,
    row.actual_total_tokens ?? null,
    row.actual_cache_read_tokens ?? null,
    row.actual_cache_write_tokens ?? null,
    row.estimated_usd_saved ?? null,
    row.mcp_description_tokens_saved ?? 0,
    row.multimodal_skip_count ?? 0,
    row.receipt_source ?? null,
    row.validation_fallback ? 1 : 0,
    row.output_mode ?? null,
    row.rtk_raw_output_pointer ?? null,
    row.rtk_raw_output_bytes ?? null,
    row.rtk_raw_output_pointers ?? null,
    row.rtk_raw_output_total_bytes ?? null,
    row.skip_reason ?? null
=======
    row.request_id ?? null
>>>>>>> Stashed changes
  );
}

export function getCompressionAnalyticsSummary(since?: string): CompressionAnalyticsSummary {
  const db = getDbInstance();

  let cutoff: string | null = null;
  if (since === "24h") {
    cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  } else if (since === "7d") {
    cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (since === "30d") {
    cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const whereClause = cutoff ? "WHERE timestamp >= ?" : "";
  const params = cutoff ? [cutoff] : [];
  // Saving aggregates count net-saving runs only: no-op/skip rows (skip_reason set)
  // are excluded so historical totals/avgs are unchanged, while skips are surfaced
  // separately below. (#4268)
  const successWhere = appendCondition(whereClause, "skip_reason IS NULL");

  type ScalarRow = { total: number; totalSaved: number; avgPct: number; avgDur: number };
  const scalar = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(tokens_saved), 0) as totalSaved,
      COALESCE(AVG(CASE WHEN original_tokens > 0 THEN CAST(tokens_saved AS REAL) / original_tokens * 100 ELSE 0 END), 0) as avgPct,
      COALESCE(AVG(duration_ms), 0) as avgDur
    FROM compression_analytics ${successWhere}
  `
    )
    .get(...params) as ScalarRow;

  const modeRows = db
    .prepare(
      `
    SELECT mode, COUNT(*) as cnt, COALESCE(SUM(tokens_saved), 0) as saved,
      COALESCE(AVG(CASE WHEN original_tokens > 0 THEN CAST(tokens_saved AS REAL) / original_tokens * 100 ELSE 0 END), 0) as avgPct
    FROM compression_analytics ${successWhere}
    GROUP BY mode
  `
    )
    .all(...params) as Array<{ mode: string; cnt: number; saved: number; avgPct: number }>;

  // Attempted-but-no-op runs per mode (skip_reason set) — recorded since #4268 so
  // Stacked is visible even when it saves nothing.
  const skipModeRows = db
    .prepare(
      `
    SELECT mode, COUNT(*) as cnt
    FROM compression_analytics ${appendCondition(whereClause, "skip_reason IS NOT NULL")}
    GROUP BY mode
  `
    )
    .all(...params) as Array<{ mode: string; cnt: number }>;

  const byMode: Record<
    string,
    { count: number; tokensSaved: number; avgSavingsPct: number; skipped: number }
  > = {};
  for (const r of modeRows) {
    byMode[r.mode] = {
      count: r.cnt,
      tokensSaved: r.saved,
      avgSavingsPct: Math.round(r.avgPct),
      skipped: 0,
    };
  }
  for (const r of skipModeRows) {
    if (byMode[r.mode]) byMode[r.mode].skipped = r.cnt;
    else byMode[r.mode] = { count: 0, tokensSaved: 0, avgSavingsPct: 0, skipped: r.cnt };
  }

<<<<<<< Updated upstream
  const engineRows = db
    .prepare(
      `
    SELECT COALESCE(engine, mode) as engine, COUNT(*) as cnt, COALESCE(SUM(tokens_saved), 0) as saved,
      COALESCE(AVG(CASE WHEN original_tokens > 0 THEN CAST(tokens_saved AS REAL) / original_tokens * 100 ELSE 0 END), 0) as avgPct
    FROM compression_analytics ${successWhere}
    GROUP BY COALESCE(engine, mode)
  `
    )
    .all(...params) as Array<{ engine: string; cnt: number; saved: number; avgPct: number }>;

  const byEngine: Record<string, { count: number; tokensSaved: number; avgSavingsPct: number }> =
    {};
  for (const r of engineRows) {
    byEngine[r.engine] = {
      count: r.cnt,
      tokensSaved: r.saved,
      avgSavingsPct: Math.round(r.avgPct),
    };
  }

  const compressionComboRows = db
    .prepare(
      `
    SELECT compression_combo_id as compressionComboId, COUNT(*) as cnt,
      COALESCE(SUM(tokens_saved), 0) as saved
    FROM compression_analytics ${appendCondition(successWhere, "compression_combo_id IS NOT NULL")}
    GROUP BY compression_combo_id ORDER BY cnt DESC
  `
    )
    .all(...params) as Array<{ compressionComboId: string | null; cnt: number; saved: number }>;

  const byCompressionCombo: Record<string, { count: number; tokensSaved: number }> = {};
  for (const r of compressionComboRows) {
    const key = r.compressionComboId ?? "unknown";
    byCompressionCombo[key] = { count: r.cnt, tokensSaved: r.saved };
  }

=======
>>>>>>> Stashed changes
  const provRows = db
    .prepare(
      `
    SELECT provider, COUNT(*) as cnt, COALESCE(SUM(tokens_saved), 0) as saved
    FROM compression_analytics ${successWhere}
    GROUP BY provider ORDER BY cnt DESC
  `
    )
    .all(...params) as Array<{ provider: string | null; cnt: number; saved: number }>;

  const byProvider: Record<string, { count: number; tokensSaved: number }> = {};
  for (const r of provRows) {
    const key = r.provider ?? "unknown";
    byProvider[key] = { count: r.cnt, tokensSaved: r.saved };
  }

  const hourRows = db
    .prepare(
      `
    SELECT strftime('%Y-%m-%dT%H:00:00Z', timestamp) as hour,
      COUNT(*) as cnt, COALESCE(SUM(tokens_saved), 0) as saved
    FROM compression_analytics
    WHERE timestamp >= ? AND skip_reason IS NULL
    GROUP BY hour ORDER BY hour ASC
  `
    )
    .all(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as Array<{
    hour: string;
    cnt: number;
    saved: number;
  }>;

<<<<<<< Updated upstream
  for (const r of hourRows) {
    if (last24hMap.has(r.hour)) {
      last24hMap.set(r.hour, { hour: r.hour, count: r.cnt, tokensSaved: r.saved });
    }
  }

  const last24h = Array.from(last24hMap.values());

  const receiptRows = db
    .prepare(
      `
    SELECT receipt_source as source, COUNT(*) as cnt,
      COALESCE(SUM(actual_prompt_tokens), 0) as prompt,
      COALESCE(SUM(actual_completion_tokens), 0) as completion,
      COALESCE(SUM(actual_total_tokens), 0) as total,
      COALESCE(SUM(actual_cache_read_tokens), 0) as cacheRead,
      COALESCE(SUM(actual_cache_write_tokens), 0) as cacheWrite,
      COALESCE(SUM(estimated_usd_saved), 0) as usdSaved
    FROM compression_analytics ${appendCondition(successWhere, "receipt_source IS NOT NULL")}
    GROUP BY receipt_source
  `
    )
    .all(...params) as Array<{
    source: string | null;
    cnt: number;
    prompt: number;
    completion: number;
    total: number;
    cacheRead: number;
    cacheWrite: number;
    usdSaved: number;
  }>;

  const realUsage = {
    requestsWithReceipts: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedUsdSaved: 0,
    bySource: {} as Record<string, number>,
  };
  for (const row of receiptRows) {
    const source = row.source ?? "unknown";
    realUsage.requestsWithReceipts += row.cnt;
    realUsage.promptTokens += row.prompt;
    realUsage.completionTokens += row.completion;
    realUsage.totalTokens += row.total;
    realUsage.cacheReadTokens += row.cacheRead;
    realUsage.cacheWriteTokens += row.cacheWrite;
    realUsage.estimatedUsdSaved += row.usdSaved;
    realUsage.bySource[source] = row.cnt;
  }

  const fallbackRow = db
    .prepare(
      `
    SELECT COUNT(*) as cnt
    FROM compression_analytics ${appendCondition(successWhere, "validation_fallback = 1")}
  `
    )
    .get(...params) as { cnt: number } | undefined;

  const mcpDescriptionRow = db
    .prepare(
      `
    SELECT COUNT(*) as cnt, COALESCE(SUM(mcp_description_tokens_saved), 0) as saved
    FROM compression_analytics ${appendCondition(successWhere, "mcp_description_tokens_saved > 0")}
  `
    )
    .get(...params) as { cnt: number; saved: number } | undefined;
=======
  const last24h = hourRows.map((r) => ({ hour: r.hour, count: r.cnt, tokensSaved: r.saved }));
>>>>>>> Stashed changes

  const skipReasonRows = db
    .prepare(
      `
    SELECT skip_reason as reason, COUNT(*) as cnt
    FROM compression_analytics ${appendCondition(whereClause, "skip_reason IS NOT NULL")}
    GROUP BY skip_reason
  `
    )
    .all(...params) as Array<{ reason: string | null; cnt: number }>;

  const bySkipReason: Record<string, number> = {};
  let totalSkipped = 0;
  for (const r of skipReasonRows) {
    const key = r.reason ?? "unknown";
    bySkipReason[key] = r.cnt;
    totalSkipped += r.cnt;
  }

  return {
    totalRequests: scalar.total,
    totalTokensSaved: scalar.totalSaved,
    avgSavingsPct: Math.round(scalar.avgPct),
    avgDurationMs: Math.round(scalar.avgDur),
    byMode,
    byProvider,
    last24h,
<<<<<<< Updated upstream
    totalSkipped,
    bySkipReason,
    validationFallbacks: fallbackRow?.cnt ?? 0,
    realUsage,
    mcpDescriptionCompression: {
      snapshots: mcpDescriptionRow?.cnt ?? 0,
      estimatedTokensSaved: mcpDescriptionRow?.saved ?? 0,
    },
=======
>>>>>>> Stashed changes
  };
}
