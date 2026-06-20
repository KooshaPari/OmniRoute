-- Migration 103: cost_events (B5 of v8.1 Bifrost track, ADR-031 § 4)
--
-- Append-only ledger of billable events emitted by the request pipeline
-- (or batched from upstream receipts). Every `recordVirtualKeyUsage` in
-- the virtual_keys module writes one cost_event row on success; the
-- A2A `cost-analysis` skill reads these rows via summarizeCostForTenant
-- / summarizeCostForKey.
--
-- `tenant_id` is denormalised so the per-tenant rollups do not need to
-- join through virtual_keys on the hot read path. The composite indexes
-- keep the time-window filter (occurred_at >= ?) on either axis cheap.
--
-- The ledger is intentionally append-only — there is no UPDATE or DELETE
-- path. Retention/cold-storage is the operator's responsibility (the
-- default prune script is documented in docs/frameworks/VIRTUAL-KEYS.md).

CREATE TABLE IF NOT EXISTS cost_events (
  id                TEXT PRIMARY KEY,
  virtual_key_id    TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd          REAL NOT NULL DEFAULT 0,
  occurred_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (virtual_key_id) REFERENCES virtual_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cost_events_key_time
  ON cost_events(virtual_key_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_cost_events_tenant_time
  ON cost_events(tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_cost_events_occurred_at
  ON cost_events(occurred_at);
