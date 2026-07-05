-- Migration 070: Add kind and encrypted metadata to webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '["*"]',
  secret TEXT,
  enabled INTEGER DEFAULT 1,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  last_triggered_at TEXT,
  last_status INTEGER,
  failure_count INTEGER DEFAULT 0
);

ALTER TABLE webhooks ADD COLUMN kind TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE webhooks ADD COLUMN metadata_encrypted BLOB;
