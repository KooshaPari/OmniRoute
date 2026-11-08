/**
 * dbCoreTypes.ts — Shared types, constants, and environment detection for the db layer.
 *
 * Extracted from core.ts to reduce module size. All domain modules import
 * environment constants and shared types from here or re-exported via core.ts.
 */

import type { SqliteAdapter } from "./adapters/types";
import { resolveWritableDataDir, getLegacyDotDataDir } from "../dataPaths";
import { isNextBuildPhase } from "../buildPhase";
import path from "path";

// ──────────────── Type Aliases ────────────────

export type SqliteDatabase = SqliteAdapter;
export type JsonRecord = Record<string, unknown>;

// ──────────────── Types ────────────────

export type PreservedTableSnapshot = {
  table: string;
  rowCount: number;
  maxRows: number;
  columns: string[];
  rows: JsonRecord[];
};

export type SkippedTableSnapshot = {
  table: string;
  rowCount: number;
  maxRows: number;
  reason: string;
};

export type PreservedCriticalDbState = {
  captureSucceeded: boolean;
  captureError: string | null;
  preservedTables: PreservedTableSnapshot[];
  skippedTables: SkippedTableSnapshot[];
};

export type CriticalTableSpec = {
  table: string;
  maxRows?: number;
  readRows?: (db: SqliteDatabase) => JsonRecord[];
};

// ──────────────── Environment Detection ────────────────

export const isCloud = typeof globalThis.caches === "object" && globalThis.caches !== null;

// Next.js build workers sometimes drop NEXT_PHASE from their env, so
// OMNIROUTE_BUILDING=1 (set by build-next-isolated.mjs and inherited by every
// spawned build worker) is the reliable build signal. During build the native
// better-sqlite3 addon must never load: its Statement destructor aborts with
// SIGABRT when the worker thread exits (assertion in
// node::RemoveEnvironmentCleanupHook, env == nullptr). (#10060)
//
// Delegates to the shared leaf helper (src/lib/buildPhase.ts) so every build
// signal is defined in exactly one place. Kept as a module const (evaluated at
// import time) to preserve the existing eager-boolean semantics of the many
// `if (isBuildPhase || isCloud)` call sites across the db layer.
export const isBuildPhase = isNextBuildPhase();

// ──────────────── Paths ────────────────

export const DATA_DIR = resolveWritableDataDir({ isCloud });
export const LEGACY_DATA_DIR = isCloud ? null : getLegacyDotDataDir();
export const SQLITE_FILE = isCloud ? null : path.join(DATA_DIR, "storage.sqlite");
export const JSON_DB_FILE = isCloud ? null : path.join(DATA_DIR, "db.json");
export const DB_BACKUPS_DIR = isCloud ? null : path.join(DATA_DIR, "db_backups");

// ──────────────── Critical Table Config ────────────────

export const DEFAULT_CRITICAL_TABLE_ROW_LIMIT = 10_000;

export const SKIP_PRESERVE_NAMESPACES = new Set([
  "syncedAvailableModels",
  "providerLimitsCache",
  "lkgp",
  "gemini_thought_signatures",
]);

export const CRITICAL_DB_TABLES: CriticalTableSpec[] = [
  {
    table: "key_value",
    maxRows: 10_000,
    readRows(db) {
      return (
        (db.prepare("SELECT namespace, key, value FROM key_value").all() as JsonRecord[]) ?? []
      ).filter(
        (row) => typeof row.namespace !== "string" || !SKIP_PRESERVE_NAMESPACES.has(row.namespace)
      );
    },
  },
  { table: "provider_connections", maxRows: 5_000 },
  { table: "provider_nodes", maxRows: 5_000 },
  { table: "combos", maxRows: 5_000 },
  { table: "api_keys", maxRows: 5_000 },
  { table: "proxy_registry", maxRows: 5_000 },
  { table: "proxy_assignments", maxRows: 10_000 },
  { table: "model_combo_mappings", maxRows: 5_000 },
  { table: "sync_tokens", maxRows: 5_000 },
  { table: "registered_keys", maxRows: 10_000 },
  { table: "provider_key_limits", maxRows: 10_000 },
  { table: "account_key_limits", maxRows: 10_000 },
  { table: "upstream_proxy_config", maxRows: 5_000 },
  { table: "webhooks", maxRows: 5_000 },
];

// ──────────────── Global Declarations ────────────────

declare global {
  // Cycle-breaker counter for the probe-failed/restore cascade. Survives
  // Next.js HMR re-evaluations so concurrent subsystems all see the same
  // count and we abort with a clear error instead of looping forever.
  var __omnirouteDbProbeRestoreCount: number | undefined;
  // Cycle-breaker counter for the OOM-during-probe path (#6835). Unlike the
  // generic corruption path above, an OOM probe failure never renames the
  // file away (intentional — the DB may be perfectly fine, just too large
  // for the current heap), so the restore-count cap above is structurally
  // unreachable here. Without an independent cap, every background poller
  // (BATCH, HealthCheck, ProviderLimitsSync, ModelSync) re-throws the same
  // OOM error forever with no terminal diagnostic.
  var __omnirouteDbOomFailureCount: number | undefined;
}
