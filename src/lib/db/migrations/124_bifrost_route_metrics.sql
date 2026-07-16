-- 124_bifrost_route_metrics.sql
-- Bounded persistence for Bifrost provider/model routing outcomes.
--
-- Stores only the raw bounded samples needed by projection math:
--   - timestamp
--   - status/outcome
--   - end-to-end latency
--   - TTFT + tokens/duration telemetry
--
-- Data is intentionally bounded to keep startup hydration fast:
--   - max 64 samples per provider+model
--   - max 512 provider+model keys
--
-- Companion module: src/lib/db/bifrostRouteMetrics.ts
-- Companion in-memory module: open-sse/observability/bifrostRouteMetrics.ts

CREATE TABLE IF NOT EXISTS bifrost_route_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  status INTEGER,
  latency_ms INTEGER NOT NULL,
  ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
  error TEXT,
  ttft_ms INTEGER,
  output_tokens INTEGER,
  generation_duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brm_provider_model_ts
  ON bifrost_route_metrics (provider, model, timestamp_ms DESC);
