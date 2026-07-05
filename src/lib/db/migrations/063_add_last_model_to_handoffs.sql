-- Migration 063: Add last_model column to context_handoffs
-- Tracks which model generated the handoff summary for debugging transparency.

CREATE TABLE IF NOT EXISTS context_handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  combo_name TEXT NOT NULL,
  from_account TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_decisions TEXT NOT NULL DEFAULT '[]',
  task_progress TEXT NOT NULL DEFAULT '',
  active_entities TEXT NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  warning_threshold_pct REAL NOT NULL DEFAULT 0.85,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, combo_name)
);

ALTER TABLE context_handoffs ADD COLUMN last_model TEXT;

CREATE INDEX IF NOT EXISTS idx_context_handoffs_last_model
ON context_handoffs(session_id, combo_name, last_model);
