-- 100_provider_health_history.sql
-- Phase 3 self-healing v2: rolling window of per-provider health samples
-- so the AnomalyDetector can compute rolling z-scores across a stable window.

CREATE TABLE IF NOT EXISTS provider_health_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_key TEXT NOT NULL,
  sampled_at INTEGER NOT NULL,                        -- epoch seconds
  error_rate REAL NOT NULL,                           -- 0.0..1.0
  p95_latency_ms REAL NOT NULL,                       -- p95 latency, ms
  active_combo_count INTEGER NOT NULL DEFAULT 0,      -- connections / in-flight pairs
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  samples_window INTEGER NOT NULL DEFAULT 60,         -- derivation window size
  telemetry_hash TEXT NOT NULL,                       -- xxxhash of (provider_key|sampled_at|error_rate|p95)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_health_history_provider_time
  ON provider_health_history(provider_key, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_health_history_sampled_at
  ON provider_health_history(sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_health_history_hash
  ON provider_health_history(telemetry_hash);
