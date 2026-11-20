/**
 * dbHealthCheck.ts — Periodic database health check scheduling.
 *
 * Extracted from core.ts. Manages the timer-based health check that runs
 * at configurable intervals (default 6h) to verify SQLite integrity and
 * perform auto-repair when needed.
 */

import type { SqliteDatabase } from "./dbCoreTypes";
import { isCloud, isBuildPhase } from "./dbCoreTypes";
import { isAutomatedTestProcess } from "@/shared/utils/testProcess";
import { runDbHealthCheck } from "./healthCheck";

// ──────────────── Health Check Scheduling ────────────────

let dbHealthCheckTimer: NodeJS.Timeout | null = null;

export function shouldRunStartupDbHealthCheck(): boolean {
  if (process.env.OMNIROUTE_FORCE_DB_HEALTHCHECK === "1") return true;
  return !isAutomatedTestProcess();
}

export function getDbHealthCheckIntervalMs(): number {
  const rawValue = process.env.OMNIROUTE_DB_HEALTHCHECK_INTERVAL_MS;
  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 6 * 60 * 60 * 1000;
}

export function clearDbHealthCheckScheduler() {
  if (dbHealthCheckTimer) {
    clearInterval(dbHealthCheckTimer);
    dbHealthCheckTimer = null;
  }
}

/**
 * Creates a health-check backup callback bound to the given database instance.
 * Used by both the startup path and the periodic scheduler.
 */
export function createHealthCheckBackupFn(
  db: SqliteDatabase,
  createManagedDbBackup: (db: SqliteDatabase, reason: string) => boolean
): () => boolean {
  return () => createManagedDbBackup(db, "health-check-repair");
}

export function startDbHealthCheckScheduler(
  db: SqliteDatabase,
  createManagedDbBackup: (db: SqliteDatabase, reason: string) => boolean
) {
  clearDbHealthCheckScheduler();
  if (isCloud || isBuildPhase || isAutomatedTestProcess()) return;

  const intervalMs = getDbHealthCheckIntervalMs();
  if (intervalMs <= 0) return;

  const backupFn = createHealthCheckBackupFn(db, createManagedDbBackup);
  dbHealthCheckTimer = setInterval(() => {
    try {
      if (!db.open) return;
      runDbHealthCheck(db, {
        autoRepair: true,
        skipIntegrityCheck: process.env.OMNIROUTE_SKIP_DB_HEALTHCHECK === "1",
        expectedSchemaVersion: "1",
        createBackupBeforeRepair: backupFn,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[DB] Periodic health-check failed:", message);
    }
  }, intervalMs);
  dbHealthCheckTimer.unref?.();
}

// Auto-checkpoint moves WAL pages back into the main DB file but never shrinks the WAL
// file itself; only wal_checkpoint(TRUNCATE) does, and a long-running server never closes its DB.
// The scheduler lives in ./walMaintenance (periodic TRUNCATE + busy warn + PASSIVE retry).

/**
 * Run a managed health check against the singleton DB instance.
 * The caller (core.ts) passes `getDbInstance` and `createManagedDbBackup`
 * to avoid circular dependencies.
 */
export function runManagedDbHealthCheck(
  getDbInstance: () => SqliteDatabase,
  createManagedDbBackup: (db: SqliteDatabase, reason: string) => boolean,
  options?: { autoRepair?: boolean }
) {
  const db = getDbInstance();
  return runDbHealthCheck(db, {
    autoRepair: options?.autoRepair === true,
    expectedSchemaVersion: "1",
    createBackupBeforeRepair: createHealthCheckBackupFn(db, createManagedDbBackup),
  });
}
