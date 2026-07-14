-- 0005: model_records
CREATE TABLE IF NOT EXISTS model_records (
    id TEXT PRIMARY KEY NOT NULL,
    provider_id TEXT NOT NULL REFERENCES provider_records(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    display_name TEXT,
    context_window INTEGER,
    max_output_tokens INTEGER,
    input_modalities TEXT NOT NULL DEFAULT '["text"]',
    output_modalities TEXT NOT NULL DEFAULT '["text"]',
    supports_tools INTEGER NOT NULL DEFAULT 0,
    supports_vision INTEGER NOT NULL DEFAULT 0,
    supports_streaming INTEGER NOT NULL DEFAULT 1,
    supports_reasoning INTEGER NOT NULL DEFAULT 0,
    cost_input_per_1k REAL,
    cost_output_per_1k REAL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_models_provider ON model_records(provider_id);
CREATE INDEX IF NOT EXISTS idx_models_name ON model_records(provider_id, model_name);
