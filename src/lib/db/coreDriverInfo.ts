/**
 * coreDriverInfo.ts — Runtime driver info and async DB initializer.
 *
 * Extracted from core.ts. Caches which SQLite driver resolved at runtime
 * and provides the async initializer that pre-resolves the SQLite runtime
 * before first DB access.
 */

import type { SqliteDatabase } from "./dbCoreTypes";
import { isCloud, isBuildPhase, SQLITE_FILE } from "./dbCoreTypes";
import { tryOpenSync, preInitSqlJs } from "./adapters/driverFactory";
import { getExistingDbInstance as getDb } from "./singleton";

// ──────────────── Runtime Driver Info ────────────────

export type DbDriverInfo = { source: string; kind: string };
let driverInfoCached: DbDriverInfo | null = null;

export function setDriverInfo(info: DbDriverInfo) {
  driverInfoCached = info;
}

/** Returns how better-sqlite3 was resolved (bundled / runtime / etc.). Null if not yet init. */
export function getDriverInfo(): DbDriverInfo | null {
  return driverInfoCached;
}

/**
 * Async initializer that pre-resolves the SQLite runtime before first DB access.
 *
 * Call this at process startup (before any call to getDbInstance()) so that
 * if the bundled better-sqlite3 binary is unavailable, the runtime installer
 * can place it in ~/.omniroute/runtime/ without blocking a synchronous caller.
 *
 * Idempotent — safe to call multiple times.
 */
export async function ensureDbInitialized(): Promise<void> {
  if (getDb()) return;

  // Cloud/build: getDbInstance() cria in-memory, sem necessidade de pré-init
  if (isCloud || isBuildPhase || !SQLITE_FILE) {
    const { getDbInstance: getInstance } = await import("./core");
    getInstance();
    return;
  }

  // Tenta drivers síncronos primeiro
  const sync = tryOpenSync(SQLITE_FILE);
  if (sync) {
    // Drivers síncronos disponíveis — fechar o probe, getDbInstance() vai abrir com setup completo
    sync.close();
    // Lazily require getDbInstance to avoid circular import at module evaluation time
    const { getDbInstance: getInstance } = await import("./core");
    getInstance();
    return;
  }

  // No synchronous driver available — pre-initialize sql.js (WASM, async)
  console.warn("[DB] Pre-initializing sql.js WASM (synchronous drivers unavailable)...");
  await preInitSqlJs(SQLITE_FILE);
  // Agora getSqlJsAdapter() retornará o adapter, e getDbInstance() vai usá-lo
  const { getDbInstance: getInstance } = await import("./core");
  getInstance();
}
