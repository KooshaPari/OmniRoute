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
}

export interface CompressionAnalyticsSummary {
  totalRequests: number;
  totalTokensSaved: number;
  avgSavingsPct: number;
  avgDurationMs: number;
  byMode: Record<string, { count: number; tokensSaved: number; avgSavingsPct: number }>;
  byProvider: Record<string, { count: number; tokensSaved: number }>;
  last24h: Array<{ hour: string; count: number; tokensSaved: number }>;
}

export function insertCompressionAnalyticsRow(row: CompressionAnalyticsRow): void {
  const db = getDbInstance();
  db.prepare(
    `
    INSERT INTO compression_analytics (timestamp, combo_id, provider, mode, original_tokens, compressed_tokens, tokens_saved, duration_ms, request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    row.request_id ?? null
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

  type ScalarRow = { total: number; totalSaved: number; avgPct: number; avgDur: number };
  const scalar = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(tokens_saved), 0) as totalSaved,
      COALESCE(AVG(CASE WHEN original_tokens > 0 THEN CAST(tokens_saved AS REAL) / original_tokens * 100 ELSE 0 END), 0) as avgPct,
      COALESCE(AVG(duration_ms), 0) as avgDur
    FROM compression_analytics ${whereClause}
  `
    )
    .get(...params) as ScalarRow;

  const modeRows = db
    .prepare(
      `
    SELECT mode, COUNT(*) as cnt, COALESCE(SUM(tokens_saved), 0) as saved,
      COALESCE(AVG(CASE WHEN original_tokens > 0 THEN CAST(tokens_saved AS REAL) / original_tokens * 100 ELSE 0 END), 0) as avgPct
    FROM compression_analytics ${whereClause}
    GROUP BY mode
  `
    )
    .all(...params) as Array<{ mode: string; cnt: number; saved: number; avgPct: number }>;

  const byMode: Record<string, { count: number; tokensSaved: number; avgSavingsPct: number }> = {};
  for (const r of modeRows) {
    byMode[r.mode] = { count: r.cnt, tokensSaved: r.saved, avgSavingsPct: Math.round(r.avgPct) };
  }

  const provRows = db
    .prepare(
      `
    SELECT provider, COUNT(*) as cnt, COALESCE(SUM(tokens_saved), 0) as saved
    FROM compression_analytics ${whereClause}
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
    WHERE timestamp >= ?
    GROUP BY hour ORDER BY hour ASC
  `
    )
    .all(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as Array<{
    hour: string;
    cnt: number;
    saved: number;
  }>;

  const last24h = hourRows.map((r) => ({ hour: r.hour, count: r.cnt, tokensSaved: r.saved }));

  return {
    totalRequests: scalar.total,
    totalTokensSaved: scalar.totalSaved,
    avgSavingsPct: Math.round(scalar.avgPct),
    avgDurationMs: Math.round(scalar.avgDur),
    byMode,
    byProvider,
    last24h,
  };
}
