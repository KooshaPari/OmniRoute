-- Migration 122: virtual_keys (renumbered from 102 to resolve a merge collision)
--
-- Per-tenant scoped credentials that OmniRoute mints, hands to the user,
-- and resolves to a real upstream key at request time. The raw key is
-- shown exactly once on creation and never again — the stored value is
-- a sha256 hex digest of the raw key (32 bytes → 64 hex chars).
--
-- Atomicity: every state-mutating path uses a single SQL UPDATE with a
--   WHERE  current_cost_usd + ? <= max_cost_usd  ... AND current_rpd + 1 <= max_rpd
-- guard, plus day-rollover handling for RPD. SQLite serialises writes
-- so two concurrent debit attempts cannot both succeed past the cap.
-- There is no read-then-write window in the application code.
--
-- `last_reset_day` carries the YYYY-MM-DD of the most recent RPD roll,
-- so the daily RPD window is a 24-hour rolling count since the row's
-- last reset (not since tenant creation).

CREATE TABLE IF NOT EXISTS virtual_keys (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  hashed_key       TEXT NOT NULL UNIQUE,
  key_prefix       TEXT NOT NULL,
  label            TEXT NOT NULL DEFAULT '',
  allowed_models   TEXT,
  max_cost_usd     REAL,
  max_rpd          INTEGER,
  current_cost_usd REAL NOT NULL DEFAULT 0,
  current_rpd      INTEGER NOT NULL DEFAULT 0,
  expires_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at     TEXT,
  last_reset_day   TEXT,
  revoked_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_virtual_keys_tenant
  ON virtual_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_virtual_keys_revoked_at
  ON virtual_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_virtual_keys_expires_at
  ON virtual_keys(expires_at);
