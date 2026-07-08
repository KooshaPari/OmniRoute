-- 20260705000002_create_api_keys.sql
-- API keys for the gateway. The hashed_secret is an Argon2id hash.
CREATE TABLE IF NOT EXISTS api_keys (
    id            TEXT PRIMARY KEY,            -- e.g. "key_xxx"
    name          TEXT NOT NULL,
    scope         TEXT NOT NULL,
    tier          TEXT NOT NULL,
    hashed_secret TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    last_used_at  INTEGER NULL,
    revoked_at    INTEGER NULL,
    metadata      TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hashed_secret ON api_keys (hashed_secret);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys (revoked_at);
