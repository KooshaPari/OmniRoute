-- 0006: call_logs
CREATE TABLE IF NOT EXISTS call_logs (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
    provider_id TEXT REFERENCES provider_records(id) ON DELETE SET NULL,
    model_id TEXT REFERENCES model_records(id) ON DELETE SET NULL,
    model_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'cancelled', 'pending')),
    http_status INTEGER,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error_kind TEXT,
    error_message TEXT,
    request_id TEXT NOT NULL,
    session_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_time ON call_logs(tenant_id, started_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_workspace_time ON call_logs(workspace_id, started_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_request ON call_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_model ON call_logs(model_name, started_at);
