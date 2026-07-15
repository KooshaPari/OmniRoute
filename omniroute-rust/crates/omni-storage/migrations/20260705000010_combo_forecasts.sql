-- 0010: combo_forecasts — model scoring cache
CREATE TABLE IF NOT EXISTS combo_forecasts (
    id TEXT PRIMARY KEY NOT NULL,
    combo_id TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    forecast_at TEXT NOT NULL,
    expected_score REAL NOT NULL,
    actual_score REAL,
    metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_combo_forecasts_combo ON combo_forecasts(combo_id, forecast_at);
