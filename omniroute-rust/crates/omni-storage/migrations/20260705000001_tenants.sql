-- 0001: tenants
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    contact_email TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'deleted')),
    plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise', 'internal')),
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
