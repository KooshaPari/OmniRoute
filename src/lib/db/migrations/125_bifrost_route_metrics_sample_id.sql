-- 125_bifrost_route_metrics_sample_id.sql
-- Migration to support append-only persistence and deterministic deduplication for
-- Bifrost route metrics samples.
--
-- Adds a stable sample identity column and a unique index so concurrent writers can
-- safely upsert without delete/reinsert loss across processes sharing the DB.

ALTER TABLE bifrost_route_metrics
  ADD COLUMN sample_id TEXT;

UPDATE bifrost_route_metrics
   SET sample_id = printf('legacy-%d', id)
 WHERE sample_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_brm_sample_id
  ON bifrost_route_metrics (sample_id);
