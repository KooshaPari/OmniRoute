CREATE TABLE IF NOT EXISTS usage_event_receipts (
  event_id TEXT PRIMARY KEY NOT NULL,
  payload_sha256 TEXT NOT NULL,
  usage_row_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
