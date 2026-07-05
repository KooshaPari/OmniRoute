-- Migration 032: API Key lifecycle hardening
--
-- Adds explicit lifecycle and policy columns to api_keys without touching the
-- existing `key` column.

ALTER TABLE api_keys ADD COLUMN revoked_at TEXT;
ALTER TABLE api_keys ADD COLUMN expires_at TEXT;
ALTER TABLE api_keys ADD COLUMN last_used_at TEXT;
ALTER TABLE api_keys ADD COLUMN key_prefix TEXT;
ALTER TABLE api_keys ADD COLUMN ip_allowlist TEXT;
ALTER TABLE api_keys ADD COLUMN scopes TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
