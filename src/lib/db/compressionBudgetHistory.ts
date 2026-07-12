import type { BudgetHistoryPoint } from "@omniroute/open-sse/services/compression/budgetForecast";
import { getDbInstance } from "./core";

interface CompressionBudgetHistoryRow {
  timestamp: string | null;
  original_tokens: number | null;
  tokens_saved: number | null;
}

export function readCompressionBudgetHistory(
  windowMs: number,
  provider: string | null,
  maxRows: number
): BudgetHistoryPoint[] {
  const cutoff = new Date(Date.now() - Math.max(1, windowMs)).toISOString();
  const db = getDbInstance();

  let rows: CompressionBudgetHistoryRow[];
  if (provider) {
    rows = db
      .prepare(
        `SELECT timestamp, original_tokens, tokens_saved
           FROM compression_analytics
          WHERE timestamp >= ? AND provider = ?
          ORDER BY timestamp DESC, id DESC
          LIMIT ?`
      )
      .all(cutoff, provider, maxRows) as CompressionBudgetHistoryRow[];
  } else {
    rows = db
      .prepare(
        `SELECT timestamp, original_tokens, tokens_saved
           FROM compression_analytics
          WHERE timestamp >= ?
          ORDER BY timestamp DESC, id DESC
          LIMIT ?`
      )
      .all(cutoff, maxRows) as CompressionBudgetHistoryRow[];
  }

  const history: BudgetHistoryPoint[] = [];
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
    history.push({ tsMs, tokens: originalTokens, savedTokens: tokensSaved });
  }
  return history;
}
