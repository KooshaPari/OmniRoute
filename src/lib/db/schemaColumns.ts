/**
 * db/schemaColumns.ts — idempotent schema-column reconciliation + table introspection.
 *
 * Extracted from db/core.ts (god-file decomposition): the helpers that bring older SQLite
 * files up to the current column set (ALTER TABLE … ADD COLUMN, guarded by PRAGMA
 * table_info) plus the small introspection utilities they build on. Each takes the db
 * handle explicitly — no module state — so they live as a co-located leaf that core.ts
 * calls during getDbInstance() bootstrap. Behavior-preserving move.
 */

import type { SqliteAdapter } from "./adapters/types";
import { createLogger } from "@/shared/utils/logger";

type SqliteDatabase = SqliteAdapter;

const log = createLogger("db:schema-columns");

export function ensureProviderConnectionsColumns(db: SqliteDatabase) {
  try {
    const columns = db.prepare("PRAGMA table_info(provider_connections)").all() as Array<{
      name?: string;
    }>;
    const columnNames = new Set(columns.map((column) => String(column.name ?? "")));
    if (!columnNames.has("rate_limit_protection")) {
      db.exec(
        "ALTER TABLE provider_connections ADD COLUMN rate_limit_protection INTEGER DEFAULT 0"
      );
      log.info({ table: "provider_connections", column: "rate_limit_protection" }, "Added column");
    }
    if (!columnNames.has("last_used_at")) {
      db.exec("ALTER TABLE provider_connections ADD COLUMN last_used_at TEXT");
      log.info({ table: "provider_connections", column: "last_used_at" }, "Added column");
    }
    if (!columnNames.has("group")) {
      db.exec('ALTER TABLE provider_connections ADD COLUMN "group" TEXT');
      log.info({ table: "provider_connections", column: "group" }, "Added column");
    }
    if (!columnNames.has("max_concurrent")) {
      db.exec("ALTER TABLE provider_connections ADD COLUMN max_concurrent INTEGER");
      log.info({ table: "provider_connections", column: "max_concurrent" }, "Added column");
    }
    if (!columnNames.has("proxy_enabled")) {
      db.exec(
        "ALTER TABLE provider_connections ADD COLUMN proxy_enabled INTEGER NOT NULL DEFAULT 1"
      );
      log.info({ table: "provider_connections", column: "proxy_enabled" }, "Added column");
    }
    if (!columnNames.has("per_key_proxy_enabled")) {
      db.exec(
        "ALTER TABLE provider_connections ADD COLUMN per_key_proxy_enabled INTEGER NOT NULL DEFAULT 0"
      );
      log.info({ table: "provider_connections", column: "per_key_proxy_enabled" }, "Added column");
    }
    if (!columnNames.has("quota_window_thresholds_json")) {
      db.exec("ALTER TABLE provider_connections ADD COLUMN quota_window_thresholds_json TEXT");
      log.info(
        { table: "provider_connections", column: "quota_window_thresholds_json" },
        "Added column"
      );
    }
    if (!columnNames.has("rate_limit_overrides_json")) {
      db.exec("ALTER TABLE provider_connections ADD COLUMN rate_limit_overrides_json TEXT");
      log.info(
        { table: "provider_connections", column: "rate_limit_overrides_json" },
        "Added column"
      );
    }
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_pc_max_concurrent ON provider_connections(provider, max_concurrent)"
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ err: message, table: "provider_connections" }, "Failed to verify schema");
  }
}

export function ensureUsageHistoryColumns(db: SqliteDatabase) {
  try {
    const columns = db.prepare("PRAGMA table_info(usage_history)").all() as Array<{
      name?: string;
    }>;
    const columnNames = new Set(columns.map((column) => String(column.name ?? "")));

    if (!columnNames.has("success")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN success INTEGER DEFAULT 1");
      log.info({ table: "usage_history", column: "success" }, "Added column");
    }
    if (!columnNames.has("latency_ms")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN latency_ms INTEGER DEFAULT 0");
      log.info({ table: "usage_history", column: "latency_ms" }, "Added column");
    }
    if (!columnNames.has("ttft_ms")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN ttft_ms INTEGER DEFAULT 0");
      log.info({ table: "usage_history", column: "ttft_ms" }, "Added column");
    }
    if (!columnNames.has("error_code")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN error_code TEXT");
      log.info({ table: "usage_history", column: "error_code" }, "Added column");
    }
    if (!columnNames.has("service_tier")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN service_tier TEXT DEFAULT 'standard'");
      log.info({ table: "usage_history", column: "service_tier" }, "Added column");
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_uh_service_tier ON usage_history(service_tier)");
    if (!columnNames.has("combo_strategy")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN combo_strategy TEXT DEFAULT 'direct'");
      log.info({ table: "usage_history", column: "combo_strategy" }, "Added column");
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_uh_combo_strategy ON usage_history(combo_strategy)");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ err: message, table: "usage_history" }, "Failed to verify schema");
  }
}

export function ensureCallLogsColumns(db: SqliteDatabase) {
  try {
    const columns = db.prepare("PRAGMA table_info(call_logs)").all() as Array<{
      name?: string;
    }>;
    const columnNames = new Set(columns.map((column) => String(column.name ?? "")));

    if (!columnNames.has("artifact_relpath")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN artifact_relpath TEXT");
      log.info({ table: "call_logs", column: "artifact_relpath" }, "Added column");
    }
    if (!columnNames.has("has_pipeline_details")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN has_pipeline_details INTEGER DEFAULT 0");
      log.info({ table: "call_logs", column: "has_pipeline_details" }, "Added column");
    }
    if (!columnNames.has("requested_model")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN requested_model TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "requested_model" }, "Added column");
    }
    if (!columnNames.has("request_type")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN request_type TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "request_type" }, "Added column");
    }
    if (!columnNames.has("tokens_cache_read")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN tokens_cache_read INTEGER DEFAULT NULL");
      log.info({ table: "call_logs", column: "tokens_cache_read" }, "Added column");
    }
    if (!columnNames.has("tokens_cache_creation")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN tokens_cache_creation INTEGER DEFAULT NULL");
      log.info({ table: "call_logs", column: "tokens_cache_creation" }, "Added column");
    }
    if (!columnNames.has("tokens_reasoning")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN tokens_reasoning INTEGER DEFAULT NULL");
      log.info({ table: "call_logs", column: "tokens_reasoning" }, "Added column");
    }
    if (!columnNames.has("cache_source")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN cache_source TEXT DEFAULT 'upstream'");
      log.info({ table: "call_logs", column: "cache_source" }, "Added column");
    }
    if (!columnNames.has("combo_step_id")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN combo_step_id TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "combo_step_id" }, "Added column");
    }
    if (!columnNames.has("combo_execution_key")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN combo_execution_key TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "combo_execution_key" }, "Added column");
    }
    if (!columnNames.has("error_summary")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN error_summary TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "error_summary" }, "Added column");
    }
    if (!columnNames.has("detail_state")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN detail_state TEXT DEFAULT 'none'");
      log.info({ table: "call_logs", column: "detail_state" }, "Added column");
    }
    if (!columnNames.has("artifact_size_bytes")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN artifact_size_bytes INTEGER DEFAULT NULL");
      log.info({ table: "call_logs", column: "artifact_size_bytes" }, "Added column");
    }
    if (!columnNames.has("artifact_sha256")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN artifact_sha256 TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "artifact_sha256" }, "Added column");
    }
    if (!columnNames.has("has_request_body")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN has_request_body INTEGER DEFAULT 0");
      log.info({ table: "call_logs", column: "has_request_body" }, "Added column");
    }
    if (!columnNames.has("has_response_body")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN has_response_body INTEGER DEFAULT 0");
      log.info({ table: "call_logs", column: "has_response_body" }, "Added column");
    }
    if (!columnNames.has("request_summary")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN request_summary TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "request_summary" }, "Added column");
    }
    if (!columnNames.has("correlation_id")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN correlation_id TEXT DEFAULT NULL");
      log.info({ table: "call_logs", column: "correlation_id" }, "Added column");
    }

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_call_logs_requested_model ON call_logs(requested_model)"
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_call_logs_request_type ON call_logs(request_type)");
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_cl_combo_target ON call_logs(combo_name, combo_execution_key, timestamp)"
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_cl_correlation_id ON call_logs(correlation_id)");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ err: message, table: "call_logs" }, "Failed to verify schema");
  }
}

export function hasColumn(db: SqliteDatabase, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>;
  return rows.some((row) => row.name === columnName);
}

export function hasTable(db: SqliteDatabase, tableName: string): boolean {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName)
  );
}

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function getTableColumns(db: SqliteDatabase, tableName: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all() as Array<{ name?: string }>
  )
    .map((column) => String(column.name ?? ""))
    .filter((column) => column.length > 0);
}
