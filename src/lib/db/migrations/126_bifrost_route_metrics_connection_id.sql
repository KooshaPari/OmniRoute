-- Adds an optional third identity component for connection-aware Bifrost metrics.
-- Existing provider/model samples remain NULL-backed legacy buckets.
ALTER TABLE bifrost_route_metrics ADD COLUMN connection_id TEXT;
CREATE INDEX IF NOT EXISTS idx_brm_provider_model_connection_ts
  ON bifrost_route_metrics (provider, model, connection_id, timestamp_ms DESC);
