import { getDbInstance } from "./core";

const MAX_HISTORY_ROWS = 5_000;

interface CompressionBudgetAnalyticsRow {
  timestamp: string | null;
  original_tokens: number | null;
  tokens_saved: number | null;
}

export interface CompressionBudgetHistoryPoint {
  tsMs: number;
  tokens: number;
  savedTokens: number;
}

/** Read recent compression savings telemetry for budget forecasting. */
export function getCompressionBudgetHistory(
  windowMs: number,
  provider: string | null,
  nowMs = Date.now()
): CompressionBudgetHistoryPoint[] {
  const cutoff = new Date(nowMs - Math.max(1, windowMs)).toISOString();
  const db = getDbInstance();
  const rows = provider
    ? (db
        .prepare(
          `SELECT timestamp, original_tokens, tokens_saved
             FROM compression_analytics
            WHERE timestamp >= ? AND provider = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ?`
        )
        .all(cutoff, provider, MAX_HISTORY_ROWS) as CompressionBudgetAnalyticsRow[])
    : (db
        .prepare(
          `SELECT timestamp, original_tokens, tokens_saved
             FROM compression_analytics
            WHERE timestamp >= ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ?`
        )
        .all(cutoff, MAX_HISTORY_ROWS) as CompressionBudgetAnalyticsRow[]);

  return rows.flatMap((row) => {
    const tsMs = row.timestamp ? Date.parse(row.timestamp) : NaN;
    if (!Number.isFinite(tsMs)) return [];
    const tokens = finiteNumberOrZero(row.original_tokens);
    const savedTokens = finiteNumberOrZero(row.tokens_saved);
    return tokens > 0 || savedTokens > 0 ? [{ tsMs, tokens, savedTokens }] : [];
  });
}

function finiteNumberOrZero(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
