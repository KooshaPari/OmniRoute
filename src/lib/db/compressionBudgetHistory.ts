import { getDbInstance } from "./core";

export interface CompressionBudgetHistoryPoint {
  tsMs: number;
  tokens: number;
  savedTokens: number;
}

interface CompressionBudgetHistoryRow {
  timestamp: string | null;
  original_tokens: number | null;
  compressed_tokens: number | null;
  tokens_saved: number | null;
  provider: string | null;
}

const MAX_BUDGET_HISTORY_ROWS = 5_000;

export function getCompressionBudgetHistory(
  windowMs: number,
  provider: string | null
): CompressionBudgetHistoryPoint[] {
  const db = getDbInstance();
  const cutoff = new Date(Date.now() - Math.max(1, windowMs)).toISOString();

  let rows: CompressionBudgetHistoryRow[];
  if (provider) {
    rows = db
      .prepare(
        `SELECT timestamp, original_tokens, compressed_tokens, tokens_saved, provider
           FROM compression_analytics
          WHERE timestamp >= ? AND provider = ?
          ORDER BY timestamp DESC, id DESC
          LIMIT ?`
      )
      .all(cutoff, provider, MAX_BUDGET_HISTORY_ROWS) as CompressionBudgetHistoryRow[];
  } else {
    rows = db
      .prepare(
        `SELECT timestamp, original_tokens, compressed_tokens, tokens_saved, provider
           FROM compression_analytics
          WHERE timestamp >= ?
          ORDER BY timestamp DESC, id DESC
          LIMIT ?`
      )
      .all(cutoff, MAX_BUDGET_HISTORY_ROWS) as CompressionBudgetHistoryRow[];
  }

  const out: CompressionBudgetHistoryPoint[] = [];
  for (const row of rows) {
    const tsMs = row.timestamp ? Date.parse(row.timestamp) : NaN;
    if (!Number.isFinite(tsMs)) continue;
    const originalTokens =
      typeof row.original_tokens === "number" && Number.isFinite(row.original_tokens)
        ? row.original_tokens
        : 0;
    const tokensSaved =
      typeof row.tokens_saved === "number" && Number.isFinite(row.tokens_saved)
        ? row.tokens_saved
        : 0;
    if (originalTokens <= 0 && tokensSaved <= 0) continue;
    out.push({ tsMs, tokens: originalTokens, savedTokens: tokensSaved });
  }
  return out;
}
