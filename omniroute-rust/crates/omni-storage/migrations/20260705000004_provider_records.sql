-- 0004: provider_records
CREATE TABLE IF NOT EXISTS provider_records (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    base_url TEXT,
    credential TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    rate_limit_rpm INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_providers_tenant ON provider_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_providers_workspace ON provider_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_providers_name ON provider_records(tenant_id, provider_name);
