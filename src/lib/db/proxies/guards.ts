import { getDbInstance } from "../core";

export const PROXY_ALIVE_PREDICATE =
  "(p.status IS NULL OR LOWER(p.status) NOT IN ('inactive','error','disabled','dead','down'))";

export function isGlobalProxyEnabled(db: ReturnType<typeof getDbInstance>): boolean {
  try {
    const row = db
      .prepare("SELECT value FROM key_value WHERE namespace = 'settings' AND key = 'proxyEnabled'")
      .get() as { value?: string } | undefined;
    if (!row?.value) return true;
    try {
      return JSON.parse(row.value) !== false;
    } catch {
      return true;
    }
  } catch {
    return true;
  }
}

/**
 * #6246 fail-closed guard for a connection with an assigned dead proxy pool.
 * Explicitly disabling proxying globally or for the connection allows direct egress.
 *
 * #13469: `comboName` scopes the guard to the combo a request is actually
 * routed under. A combo-scoped assignment must only block when that same combo
 * is in play — otherwise a dead pool pinned to one combo would take down every
 * other combo and non-combo request on the same connection. When `comboName` is
 * omitted the combo scope is simply not considered.
 */
export function hasBlockingProxyAssignment(
  connectionId: string,
  providerId?: string,
  comboName?: string
): boolean {
  try {
    const db = getDbInstance();
    if (!isGlobalProxyEnabled(db)) return false;

    const conn = db
      .prepare("SELECT provider, proxy_enabled FROM provider_connections WHERE id = ?")
      .get(connectionId) as { provider?: string | null; proxy_enabled?: number } | undefined;
    if (conn && conn.proxy_enabled === 0) return false;
    const provider = conn?.provider ?? providerId ?? null;
    // A combo-scoped assignment only applies to the combo it was pinned to.
    // `comboName` null/undefined means this is not a combo request, so the
    // combo scope must not match anything.
    const combo = comboName || "__no_combo__";
    const dead = db
      .prepare(
        `SELECT 1 FROM proxy_assignments a JOIN proxy_registry p ON p.id = a.proxy_id
           WHERE ((a.scope = 'account' AND a.scope_id = ?)
               OR (a.scope = 'provider' AND a.scope_id = ?)
               OR (a.scope = 'combo' AND a.scope_id = ?)
               OR (a.scope = 'global'))
             AND NOT ${PROXY_ALIVE_PREDICATE}
           LIMIT 1`
      )
      .get(connectionId, provider, combo);
    return !!dead;
  } catch {
    return false;
  }
}

/**
 * #7380 fail-closed guard for providers without a connection row. Returns true
 * when a provider/global proxy assignment exists but all assigned proxies are known dead.
 */
export function hasBlockingProxyAssignmentForProvider(providerId: string): boolean {
  try {
    const db = getDbInstance();
    if (!isGlobalProxyEnabled(db)) return false;

    const assignments = db
      .prepare(
        `SELECT
           EXISTS(
             SELECT 1 FROM proxy_assignments a
             WHERE ((a.scope = 'provider' AND a.scope_id = ?)
                 OR a.scope = 'global')
           ) AS assigned,
           EXISTS(
             SELECT 1 FROM proxy_assignments a JOIN proxy_registry p ON p.id = a.proxy_id
             WHERE ((a.scope = 'provider' AND a.scope_id = ?)
                 OR a.scope = 'global')
               AND ${PROXY_ALIVE_PREDICATE}
           ) AS alive`
      )
      .get(providerId, providerId) as { assigned?: number; alive?: number } | undefined;
    return assignments?.assigned === 1 && assignments.alive === 0;
  } catch {
    return false;
  }
}
