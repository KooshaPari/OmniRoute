-- 20260705000001_create_call_logs.sql
-- Schema for the canonical call log: one row per upstream chat / embed / image call.
CREATE TABLE IF NOT EXISTS call_logs (
    id                BLOB PRIMARY KEY,
    request_id        TEXT NOT NULL,
    created_at        INTEGER NOT NULL,        -- unix epoch milliseconds
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    key_id            TEXT NULL,
    status_code       INTEGER NOT NULL,
    error             TEXT NULL,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens      INTEGER NOT NULL DEFAULT 0,
    reasoning_tokens  INTEGER NULL,
    cached_tokens     INTEGER NULL,
    cost_micros       INTEGER NULL,
    latency_ms        INTEGER NULL,
    metadata          TEXT NOT NULL DEFAULT '{}',
    request_body      TEXT NULL,
    response_body     TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_provider_model ON call_logs (provider, model);
CREATE INDEX IF NOT EXISTS idx_call_logs_key_id_created_at ON call_logs (key_id, created_at);
