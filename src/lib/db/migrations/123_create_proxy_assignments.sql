-- Migration 123: Create the proxy assignment table for installations that
-- applied migration 040 before proxy assignments were introduced.
--
-- Keep this in a new migration rather than changing 040: existing databases
-- already record 040 as applied and would otherwise never receive this table.

CREATE TABLE IF NOT EXISTS proxy_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proxy_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (proxy_id) REFERENCES proxy_registry(id) ON DELETE CASCADE,
  UNIQUE(scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_proxy_assignments_proxy_id
  ON proxy_assignments(proxy_id);
CREATE INDEX IF NOT EXISTS idx_proxy_assignments_scope
  ON proxy_assignments(scope, scope_id);
