/**
 * Probe-retry utilities for the SQLite corruption-probe path in getDbInstance().
 *
 * Transient probe errors (SQLITE_BUSY, ENOENT, SQLITE_PROTOCOL, SQLITE_IOERR)
 * should be retried with backoff instead of immediately renaming the DB away
 * and creating an empty one (data loss under concurrent load, #9541).
 *
 * Also houses error-classification helpers (isNativeSqliteLoadError,
 * isSqliteDriverUnavailableError) and the safe-probe-close utility
 * (closeProbeIfSafe) used by both the probe path and state-capture logic.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Identifies transient SQLite/OS probe errors that should be retried instead of
 * triggering the corruption-rename path.
 *
 * Transient errors are conditions that can self-resolve within milliseconds:
 *   - SQLITE_BUSY: database is locked by another connection
 *   - SQLITE_PROTOCOL: locking protocol violation
 *   - SQLITE_IOERR: disk I/O error (can be transient under load)
 *   - ENOENT: file disappeared (race with another process/worker deleting it)
 *
 * Fatal errors (native load failures, OOM, module-not-found) are NOT transient.
 */
export function isTransientProbeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // #12423 widened the message side: SQLite also reports "database table is
  // locked", "database schema is locked" and "database is busy" for the same
  // transient contention that "database is locked" covers.
  if (
    /SQLITE_BUSY|SQLITE_PROTOCOL|SQLITE_IOERR|ENOENT|database(?: table| schema)? is (?:locked|busy)/i.test(
      message
    )
  ) {
    return true;
  }
  // The real drivers do not put the result-code name in the message: both
  // report plain "database is locked" for SQLITE_BUSY. better-sqlite3 carries
  // the name in `code`, node:sqlite the numeric primary code in `errcode`
  // (5 BUSY, 10 IOERR, 15 PROTOCOL; extended codes live in the high bits).
  // Without this, a transient lock during the probe was classified as
  // corruption and the database was renamed away.
  if (typeof error !== "object" || error === null) return false;
  const { code, errcode } = error as { code?: unknown; errcode?: unknown };
  if (typeof code === "string" && /^SQLITE_(BUSY|PROTOCOL|IOERR)/.test(code)) return true;
  return typeof errcode === "number" && [5, 10, 15].includes(errcode & 0xff);
}

// ──────────────── Error Classification ────────────────

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isNativeSqliteLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);
  return (
    message.includes("Module did not self-register") ||
    message.includes("NODE_MODULE_VERSION") ||
    message.includes("ERR_DLOPEN_FAILED") ||
    // bun and similar runtimes that skip the postinstall script never download
    // the prebuilt *.node binary, so `bindings()` fails with this message
    // before any DLOPEN even happens (#2358).
    message.includes("Could not locate the bindings file") ||
    message.includes("Cannot find module 'better-sqlite3'") ||
    code === "ERR_DLOPEN_FAILED" ||
    code === "MODULE_NOT_FOUND"
  );
}

export function isSqliteDriverUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Nenhum driver SQLite disponível") ||
    message.includes("Chame ensureDbInitialized() no startup") ||
    message.includes("sql.js WASM ainda não foi pré-inicializado")
  );
}

// ──────────────── Safe Probe Close ────────────────

/**
 * Closes a probe/throwaway connection obtained from `openSqliteDatabase()` —
 * but ONLY when it is safe to do so. better-sqlite3/node:sqlite hand back an
 * independent handle per open() call, so closing a probe never affects a
 * later "real" connection to the same file. sql.js has no such notion: its
 * fallback path (`getSqlJsAdapter()`) always returns the SAME module-global
 * cached singleton for a given filePath, so closing "the probe" closes the
 * ONLY connection that file will ever get until process restart — every
 * subsequent query (including the "real" connection opened right after)
 * throws sql.js's raw "Database closed" string (#7494). Skip the close for
 * sql.js and let the same live adapter flow through untouched.
 */
export function closeProbeIfSafe(
  adapter: { driver: string; open: boolean; close(): void } | null | undefined
): void {
  if (!adapter || adapter.driver === "sql.js") return;
  if (adapter.open) adapter.close();
}

/**
 * Synchronous sleep that blocks the event loop for `ms` milliseconds.
 * Only used in the transient-probe-error retry path where we are already in
 * a synchronous context (better-sqlite3). Uses `Atomics.wait` which yields to
 * the OS scheduler during the wait, falling back to a busy-wait on runtimes
 * where Atomics.wait is restricted.
 */
function syncSleep(ms: number): void {
  if (typeof SharedArrayBuffer !== "undefined" && typeof Atomics !== "undefined") {
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      return;
    } catch {
      // Atomics.wait may throw on restricted runtimes — fall through to busy-wait
    }
  }
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    /* busy-wait */
  }
}

/**
 * Type for openSqliteDatabase callback — avoids importing the full SQLite adapter type.
 */
type OpenDbFn = (
  filePath: string,
  options?: Record<string, unknown>
) => {
  driver: string;
  open: boolean;
  close(): void;
};

/**
 * Retries opening a SQLite database probe when the initial attempt fails with
 * a transient error. Uses exponential backoff (500ms, 1000ms, 2000ms).
 *
 * @param sqliteFile - Path to the SQLite database file
 * @param openDb - Function to open the database (normally openSqliteDatabase)
 * @param closeDb - Function to safely close the probe adapter
 * @returns true if the retry succeeded (transient condition resolved)
 *          false if all retries were exhausted or error is non-transient
 */
export function retryProbeIfTransient(
  sqliteFile: string,
  probeError: unknown,
  openDb: OpenDbFn,
  closeDb: (adapter: { driver: string; open: boolean; close(): void } | null | undefined) => void
): boolean {
  if (!isTransientProbeError(probeError)) return false;

  const retryDelays = [500, 1000, 2000];
  for (let i = 0; i < retryDelays.length; i++) {
    syncSleep(retryDelays[i]);
    try {
      const retryAdapter = openDb(sqliteFile, { readonly: true });
      closeDb(retryAdapter);
      return true;
    } catch {
      // Retry failed, try next delay
    }
  }

  console.warn(
    `[DB] All ${retryDelays.length} transient probe retries exhausted — declaring corruption`
  );
  return false;
}
