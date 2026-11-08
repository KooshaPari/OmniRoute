/**
 * db/proxyLogs.ts — Read queries over the `proxy_logs` table.
 * Extracted from the /api/logs/export route handler.
 *
 * Hard Rule #5: routes must not embed raw SQL — these queries live here so the
 * /api/logs/export route can delegate.
 *
 * NOTE: The SELECT * intentionally returns the historical `public_ip` column,
 * NOT `clientIp`. This differs from GET /api/usage/proxy-logs which exposes
 * the value as `clientIp`. Callers of the export endpoint should read
 * `public_ip`. This inconsistency will be resolved in a future DB migration
 * (#2880).
 *
 * Sliced out of #3500 (proxy_logs cluster, slice 4).
 */

import { getDbInstance } from "./core";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns all proxy_logs rows with timestamp >= `since`, ordered by timestamp
 * descending (most recent first).
 *
 * @param since - ISO-8601 timestamp lower bound, e.g. "2024-01-01T00:00:00.000Z".
 */
export function exportProxyLogsSince(since: string): Record<string, unknown>[] {
  const db = getDbInstance();
  const stmt = db.prepare(
    "SELECT * FROM proxy_logs WHERE timestamp >= @since ORDER BY timestamp DESC"
  );
  return stmt.all({ since }) as Record<string, unknown>[];
}

// 24h window for "last known egress IP" lookups. This helper answers a
// different question from proxyEgress.ts (#10677): that module reports which
// connections share an egress IP *right now*, derived from their proxy config
// and a live probe (5 min cache), while the lock needs the IP a connection
// actually *left through* on its recent traffic — history, which only
// proxy_logs holds. Hence a local window constant rather than a dependency.
// Exported so callers can build `since` without duplicating the window.
export const EGRESS_IP_LOOKUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Last non-null egress IP observed for a connection within the window, or
 * null. Best-effort by design: egress_ip is only populated once the egress IP
 * has been probed (cache TTL 5 min), so a cold cache yields null and the
 * caller must fall back to today's behavior. Synchronous read (#10539 — no
 * in-memory cache to go stale). The table has no index on connection_id
 * (migration 134, YAGNI); the scan is bounded by the window via
 * idx_pl_timestamp and this helper only runs at 429 frequency.
 */
export function getRecentEgressIpForConnection(
  connectionId: string,
  since: string
): { egressIp: string; at: string } | null {
  const db = getDbInstance();
  const row = db
    .prepare(
      `SELECT egress_ip, timestamp FROM proxy_logs
       WHERE connection_id = ? AND egress_ip IS NOT NULL AND timestamp >= ?
       ORDER BY timestamp DESC LIMIT 1`
    )
    .get(connectionId, since) as { egress_ip: string; timestamp: string } | undefined;
  if (!row) return null;
  return { egressIp: row.egress_ip, at: row.timestamp };
}
