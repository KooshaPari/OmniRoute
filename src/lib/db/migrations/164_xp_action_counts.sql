-- 164_xp_action_counts.sql
--
-- Promote the per-user per-action count from a runtime COUNT() on xp_audit_log
-- into a real cache table.
--
-- WHY: every call to checkActionCountBadges() (and getActionCount(), used by
-- the streak UI) was running `SELECT COUNT(*) FROM xp_audit_log WHERE ...`
-- with the per-user, per-action filter applied. xp_audit_log grows monotonically
-- (one row per XP-earning action, never deleted) — so for an account with a few
-- months of activity this scan touches 100k+ rows per render, and it's the
-- primary source of the badge-page latency #12546 reports.
--
-- This migration creates xp_action_counts (user_id, action, count) and backfills
-- it from xp_audit_log. The application code (events.ts, badges.ts) then keeps
-- the count in sync via INSERT ... ON CONFLICT DO UPDATE inside addXp().
-- checkActionCountBadges() and getActionCount() switch to O(1) lookups.
--
-- The backfill runs in a single INSERT ... SELECT so it's atomic w.r.t. the
-- rest of the migration — readers see either the old (xp_audit_log COUNT) world
-- or the new (xp_action_counts table) world, never a partial fill. The
-- application code is updated to write-through but the read path remains the
-- source-of-truth until the migration runs (the application code in this PR
-- switches reads to xp_action_counts; the migration here provides the data).
--
-- IF NOT EXISTS / ON CONFLICT DO NOTHING keeps this idempotent for the v3.8.51+
-- installs that already have the table from a hot-patch rollout.

CREATE TABLE IF NOT EXISTS xp_action_counts (
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, action)
);

CREATE INDEX IF NOT EXISTS idx_xp_action_counts_user ON xp_action_counts(user_id);

-- Backfill from xp_audit_log. ON CONFLICT DO NOTHING so re-running is a no-op.
INSERT OR IGNORE INTO xp_action_counts (user_id, action, count)
SELECT user_id, action, COUNT(*)
FROM xp_audit_log
GROUP BY user_id, action;

-- For users who already have rows from a prior hot-patch, refresh the count
-- to match the audit log truth (in case rows were added between the hot-patch
-- and this migration):
UPDATE xp_action_counts
SET count = (
  SELECT COUNT(*) FROM xp_audit_log x
  WHERE x.user_id = xp_action_counts.user_id
    AND x.action  = xp_action_counts.action
),
updated_at = datetime('now')
WHERE EXISTS (SELECT 1 FROM xp_audit_log);
