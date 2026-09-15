/**
 * Health-check scheduler, managed backups, and legacy encryption migration.
 *
 * Extracted from core.ts to keep module size manageable. All functions that
 * need the singleton DB instance receive it via parameter or call `getDbInstance()`
 * lazily to avoid circular dependency issues with core.ts.
 */

import path from "path";
import fs from "fs";
import { runDbHealthCheck } from "./healthCheck";
import { migrateLegacyEncryptedString } from "./encryption";
import { invalidateDbCache } from "./readCache";
import { rowToCamel } from "./caseMapping";
import { isAutomatedTestProcess } from "@/shared/utils/testProcess";

// Lazy import to avoid circular dependency — core.ts imports from this module,
// and this module needs `getDbInstance` only at call-time (never at module-init).
let _getDbInstance: (() => import("./adapters/types").SqliteAdapter) | null = null;

/** Called once by core.ts during initialization to break the circular dep. */
export function bindCoreDeps(getDb: () => import("./adapters/types").SqliteAdapter) {
  _getDbInstance = getDb;
}

function requireDb(): import("./adapters/types").SqliteAdapter {
  if (!_getDbInstance) {
    throw new Error("[dbHealthScheduler] bindCoreDeps() has not been called yet");
  }
  return _getDbInstance();
}

type SqliteDatabase = import("./adapters/types").SqliteAdapter;
type JsonRecord = Record<string, unknown>;

// ──────────────── Environment flags (injected from core.ts) ────────────────

let _isCloud = false;
let _isBuildPhase = false;
let _dataDir = "";
let _dbBackupsDir = "";

/** Called once by core.ts during initialization. */
export function bindEnv(opts: {
  isCloud: boolean;
  isBuildPhase: boolean;
  dataDir: string;
  dbBackupsDir: string;
}) {
  _isCloud = opts.isCloud;
  _isBuildPhase = opts.isBuildPhase;
  _dataDir = opts.dataDir;
  _dbBackupsDir = opts.dbBackupsDir;
}

// ──────────────── Health Check Scheduling ────────────────

export function shouldRunStartupDbHealthCheck(): boolean {
  if (process.env.OMNIROUTE_FORCE_DB_HEALTHCHECK === "1") return true;
  return !isAutomatedTestProcess();
}

export function createManagedDbBackup(db: SqliteDatabase, reason: string): boolean {
  const isTest = isAutomatedTestProcess();
  if (isTest) return false;

  try {
    const backupDir = _dbBackupsDir || path.join(_dataDir, "db_backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `db_${timestamp}_${reason}.sqlite`);
    const escapedBackupPath = backupPath.replace(/'/g, "''");

    db.exec(`VACUUM INTO '${escapedBackupPath}'`);
    console.log(`[DB] Backup created (${reason}): ${backupPath}`);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[DB] Failed to create ${reason} backup:`, message);
    return false;
  }
}

export function createHealthCheckBackup(db: SqliteDatabase): boolean {
  return createManagedDbBackup(db, "health-check-repair");
}

export function autoMigrateLegacyEncryptedConnections(db: SqliteDatabase): number {
  const rows = db.prepare("SELECT * FROM provider_connections").all() as JsonRecord[];
  const updateStmt = db.prepare(
    "UPDATE provider_connections SET api_key = @apiKey, id_token = @idToken, access_token = @accessToken, refresh_token = @refreshToken, updated_at = @updatedAt WHERE id = @id"
  );
  const encryptedFields = ["apiKey", "idToken", "accessToken", "refreshToken"] as const;
  let migratedCount = 0;
  let backupCreated = false;

  for (const row of rows) {
    const camelRow = rowToCamel(row);
    if (!camelRow) continue;

    let updatedRow = false;
    for (const field of encryptedFields) {
      if (typeof camelRow[field] !== "string") continue;

      const { updated, value } = migrateLegacyEncryptedString(camelRow[field]);
      if (updated) {
        camelRow[field] = value;
        updatedRow = true;
      }
    }

    if (!updatedRow) continue;
    if (!backupCreated) {
      createManagedDbBackup(db, "legacy-encryption-migration");
      backupCreated = true;
    }

    updateStmt.run({
      id: camelRow.id,
      apiKey: camelRow.apiKey ?? null,
      idToken: camelRow.idToken ?? null,
      accessToken: camelRow.accessToken ?? null,
      refreshToken: camelRow.refreshToken ?? null,
      updatedAt: new Date().toISOString(),
    });
    migratedCount++;
  }

  if (migratedCount > 0) {
    invalidateDbCache("connections");
    console.log(`[DB] Auto-migrated ${migratedCount} connection(s) to new static-salt encryption.`);
  }

  return migratedCount;
}

let dbHealthCheckTimer: NodeJS.Timeout | null = null;

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

export function startDbHealthCheckScheduler(db: SqliteDatabase) {
  clearDbHealthCheckScheduler();
  if (_isCloud || _isBuildPhase || isAutomatedTestProcess()) return;

  const intervalMs = getDbHealthCheckIntervalMs();
  if (intervalMs <= 0) return;

  dbHealthCheckTimer = setInterval(() => {
    try {
      if (!db.open) return;
      runDbHealthCheck(db, {
        autoRepair: true,
        skipIntegrityCheck: process.env.OMNIROUTE_SKIP_DB_HEALTHCHECK === "1",
        expectedSchemaVersion: "1",
        createBackupBeforeRepair: () => createHealthCheckBackup(db),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[DB] Periodic health-check failed:", message);
    }
  }, intervalMs);
  dbHealthCheckTimer.unref?.();
}

export function runManagedDbHealthCheck(options?: { autoRepair?: boolean }) {
  const db = requireDb();
  return runDbHealthCheck(db, {
    autoRepair: options?.autoRepair === true,
    expectedSchemaVersion: "1",
    createBackupBeforeRepair: () => createHealthCheckBackup(db),
  });
}
