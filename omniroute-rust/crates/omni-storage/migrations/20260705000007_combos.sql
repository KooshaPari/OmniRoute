-- 0007: combos
CREATE TABLE IF NOT EXISTS combos (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    members TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_combos_tenant ON combos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_combos_workspace ON combos(workspace_id);
