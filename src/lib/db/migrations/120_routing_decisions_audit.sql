-- Migration 108: Routing decisions audit table
--
-- Closes DEBT-011: replaces the `// TODO: Write to database audit table`
-- placeholder in routingLogger.ts with a real persistence target.
--
-- Unlike request_detail_logs (which stores full request/response payloads),
-- routing_decisions stores lightweight decision snapshots: which provider
-- and model were selected, at what score, with what fallback chain, and
-- the W3C trace context for correlation.
--
-- Migration 002 (mcp_a2a_tables) already created a routing_decisions table
-- with an incompatible schema (provider_selected, model_selected, etc.).
-- This migration drops that table and recreates it with the correct schema
-- that routingDecisions.ts writes to. The table holds only telemetry data
-- (no user data), so dropping is safe.

DROP INDEX IF EXISTS idx_rd_request;
DROP INDEX IF EXISTS idx_rd_combo;
DROP INDEX IF EXISTS idx_rd_provider;
DROP INDEX IF EXISTS idx_rd_created;
DROP INDEX IF EXISTS idx_routing_decisions_created_at;
DROP INDEX IF EXISTS idx_routing_decisions_provider;
DROP TABLE IF EXISTS routing_decisions;

CREATE TABLE routing_decisions (
  id            TEXT PRIMARY KEY,
  task_type     TEXT NOT NULL DEFAULT '',
  combo_id      TEXT NOT NULL DEFAULT '',
  provider      TEXT NOT NULL DEFAULT '',
  model         TEXT NOT NULL DEFAULT '',
  score         REAL NOT NULL DEFAULT 0,
  factors       TEXT NOT NULL DEFAULT '[]',
  fallbacks     TEXT NOT NULL DEFAULT '[]',
  success       INTEGER NOT NULL DEFAULT 1,
  latency_ms    INTEGER NOT NULL DEFAULT 0,
  cost          REAL NOT NULL DEFAULT 0,
  trace_id      TEXT,
  span_id       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_routing_decisions_created_at
  ON routing_decisions (created_at DESC);

CREATE INDEX idx_routing_decisions_provider
  ON routing_decisions (provider, created_at DESC);
