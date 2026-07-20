-- 0001_initial.sql
-- Migration marker for schema version 1.
-- Full DDL lives in src/schema.rs (`SCHEMA_STATEMENTS`); keep both in sync
-- when adding tables. Historical TypeScript `call_logs` is not recreated here;
-- Rust uses `request_logs` as the canonical table name.

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT
);
