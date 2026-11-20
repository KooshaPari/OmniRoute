/**
 * dbBackup.ts — Database backup creation and legacy encryption migration.
 *
 * Extracted from core.ts. Handles managed VACUUM INTO backups and the
 * auto-migration of provider connection tokens to the static-salt encryption.
 */

import path from "path";
import fs from "fs";
import type { SqliteDatabase, JsonRecord } from "./dbCoreTypes";
import { DATA_DIR, DB_BACKUPS_DIR } from "./dbCoreTypes";
import { isAutomatedTestProcess } from "@/shared/utils/testProcess";
import { rowToCamel } from "./caseMapping";
import { migrateLegacyEncryptedString } from "./encryption";
import { invalidateDbCache } from "./readCache";

// ──────────────── Backup Creation ────────────────

export function createManagedDbBackup(db: SqliteDatabase, reason: string): boolean {
  const isTest = isAutomatedTestProcess();
  if (isTest) return false;

  try {
    const backupDir = DB_BACKUPS_DIR || path.join(DATA_DIR, "db_backups");
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

// ──────────────── Legacy Encryption Migration ────────────────

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
