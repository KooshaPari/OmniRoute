/**
 * dbCaptureRestore.ts — Critical database state capture and restore.
 *
 * Extracted from core.ts. Handles preserving critical table data during
 * probe failures and restoring it after database recreation.
 */

import path from "path";
import fs from "fs";
import { hasTable, quoteIdentifier, getTableColumns } from "./schemaColumns";
import { closeProbeIfSafe } from "./probeUtils";
import type {
  SqliteDatabase,
  JsonRecord,
  PreservedCriticalDbState,
  PreservedTableSnapshot,
  SkippedTableSnapshot,
} from "./dbCoreTypes";
import { CRITICAL_DB_TABLES, DEFAULT_CRITICAL_TABLE_ROW_LIMIT } from "./dbCoreTypes";

// ──────────────── Summary Helpers ────────────────

export function summarizePreservedTables(tables: PreservedTableSnapshot[]): string {
  if (tables.length === 0) return "none";
  return tables.map((table) => `${table.table}(${table.rowCount})`).join(", ");
}

export function summarizeSkippedTables(tables: SkippedTableSnapshot[]): string {
  if (tables.length === 0) return "none";
  return tables
    .map((table) => `${table.table}(${table.rowCount}/${table.maxRows}: ${table.reason})`)
    .join(", ");
}

// ──────────────── Probe Failure Backup Discovery ────────────────

export function listProbeFailureBackups(sqliteFile: string): string[] {
  const directory = path.dirname(sqliteFile);
  const baseName = path.basename(sqliteFile);
  const prefix = `${baseName}.probe-failed-`;
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix))
    .map((name) => ({
      path: path.join(directory, name),
      timestamp: Number(name.slice(prefix.length)),
    }))
    .sort((left, right) => {
      const leftTimestamp = Number.isFinite(left.timestamp) ? left.timestamp : 0;
      const rightTimestamp = Number.isFinite(right.timestamp) ? right.timestamp : 0;
      return rightTimestamp - leftTimestamp || right.path.localeCompare(left.path);
    })
    .map((backup) => backup.path);
}

// ──────────────── State Capture ────────────────

/**
 * Opens a readonly probe of the SQLite file and snapshots critical tables.
 * Used before renaming a corrupt database so data can be restored after
 * the fresh DB is created.
 */
export function captureCriticalDbState(
  sqliteFile: string,
  openSqliteDatabase: (file: string, options?: Record<string, unknown>) => SqliteDatabase
): PreservedCriticalDbState {
  const snapshot: PreservedCriticalDbState = {
    captureSucceeded: false,
    captureError: null,
    preservedTables: [],
    skippedTables: [],
  };

  if (!fs.existsSync(sqliteFile)) {
    snapshot.captureSucceeded = true;
    return snapshot;
  }

  let probe: SqliteDatabase | null = null;
  try {
    probe = openSqliteDatabase(sqliteFile, { readonly: true });

    for (const tableSpec of CRITICAL_DB_TABLES) {
      if (!hasTable(probe, tableSpec.table)) continue;

      const maxRows = tableSpec.maxRows ?? DEFAULT_CRITICAL_TABLE_ROW_LIMIT;
      const rows = (tableSpec.readRows?.(probe) ??
        (probe
          .prepare(`SELECT * FROM ${quoteIdentifier(tableSpec.table)}`)
          .all() as JsonRecord[])) as JsonRecord[];
      const rowCount = rows.length;

      if (rowCount === 0) continue;

      if (rowCount > maxRows) {
        snapshot.skippedTables.push({
          table: tableSpec.table,
          rowCount,
          maxRows,
          reason: "row_limit_exceeded",
        });
        continue;
      }

      snapshot.preservedTables.push({
        table: tableSpec.table,
        rowCount,
        maxRows,
        columns: getTableColumns(probe, tableSpec.table),
        rows,
      });
    }

    snapshot.captureSucceeded = true;
    return snapshot;
  } catch (error: unknown) {
    snapshot.captureError = error instanceof Error ? error.message : String(error);
    return snapshot;
  } finally {
    try {
      closeProbeIfSafe(probe);
    } catch {
      /* ignore */
    }
  }
}

// ──────────────── State Restore ────────────────

/**
 * Restores previously captured critical table data into a freshly created
 * database. Uses a transaction for atomicity.
 */
export function restoreCriticalDbState(
  db: SqliteDatabase,
  snapshot: PreservedCriticalDbState
): PreservedTableSnapshot[] {
  const restoredTables: PreservedTableSnapshot[] = [];

  const restore = db.transaction(() => {
    for (const table of snapshot.preservedTables) {
      if (table.rows.length === 0) continue;
      if (!hasTable(db, table.table)) {
        throw new Error(`Current schema is missing preserved table "${table.table}"`);
      }

      const currentColumns = new Set(getTableColumns(db, table.table));
      const restoreColumns = table.columns.filter((column) => currentColumns.has(column));
      if (restoreColumns.length === 0) {
        throw new Error(`No compatible columns remain for preserved table "${table.table}"`);
      }

      const sql = `INSERT OR REPLACE INTO ${quoteIdentifier(table.table)} (${restoreColumns
        .map((column) => quoteIdentifier(column))
        .join(", ")}) VALUES (${restoreColumns.map(() => "?").join(", ")})`;
      const insert = db.prepare(sql);

      for (const row of table.rows) {
        insert.run(...restoreColumns.map((column) => row[column] ?? null));
      }

      restoredTables.push(table);
    }
  });

  restore();
  return restoredTables;
}

// ──────────────── File Cleanup ────────────────

export function cleanupRecreatedSqliteFiles(sqliteFile: string) {
  for (const filePath of [
    sqliteFile,
    `${sqliteFile}-wal`,
    `${sqliteFile}-shm`,
    `${sqliteFile}-journal`,
  ]) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}
