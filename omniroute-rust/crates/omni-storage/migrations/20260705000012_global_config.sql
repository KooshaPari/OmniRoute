-- 0012: global_config — key/value runtime config
CREATE TABLE IF NOT EXISTS global_config (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
