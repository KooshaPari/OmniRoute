import { getDbInstance } from "../../db/core";
import { toNumber } from "./helpers";

/**
 * Legacy compatibility shim.
 * Request summary lines are no longer written to data/log.txt.
 */
export async function appendRequestLog({
  model: _model,
  provider: _provider,
  connectionId: _connectionId,
  tokens: _tokens,
  status: _status,
}: {
  model?: string;
  provider?: string;
  connectionId?: string;
  tokens?: unknown;
  status?: string | number;
}) {
  // Deprecated: request summaries now come from SQLite call_logs.
}

/**
 * Return recent request summaries generated from SQLite call_logs rows.
 */
export async function getRecentLogs(limit = 200) {
  try {
    const db = getDbInstance();
    const rows = db
      .prepare(
        `
        SELECT timestamp, model, provider, account, tokens_in, tokens_out, status
        FROM call_logs
        ORDER BY timestamp DESC
        LIMIT ?
      `
      )
      .all(limit) as Array<Record<string, unknown>>;

    return rows.map((row) => {
      const timestamp =
        typeof row.timestamp === "string" ? row.timestamp : new Date().toISOString();
      const provider = typeof row.provider === "string" ? row.provider.toUpperCase() : "-";
      const model = typeof row.model === "string" ? row.model : "-";
      const account = typeof row.account === "string" ? row.account : "-";
      const tokensIn = toNumber(row.tokens_in);
      const tokensOut = toNumber(row.tokens_out);
      const status = typeof row.status === "number" ? row.status : String(row.status || "-");
      return `${timestamp} | ${model} | ${provider} | ${account} | ${tokensIn} | ${tokensOut} | ${status}`;
    });
  } catch (error) {
    console.error(
      "[usageDb] Failed to read recent call logs:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}
