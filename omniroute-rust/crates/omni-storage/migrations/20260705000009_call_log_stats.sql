-- 0009: call_log_stats — aggregated view materialization table
CREATE TABLE IF NOT EXISTS call_log_stats (
    tenant_id TEXT NOT NULL,
    bucket_hour TEXT NOT NULL,
    model_name TEXT NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    PRIMARY KEY(tenant_id, bucket_hour, model_name)
);
CREATE INDEX IF NOT EXISTS idx_call_log_stats_tenant ON call_log_stats(tenant_id, bucket_hour);
