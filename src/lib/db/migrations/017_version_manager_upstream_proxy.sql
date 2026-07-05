-- Migration 016: Version Manager & Upstream Proxy tables
--
-- Adds two tables for CLIProxyAPI integration:
--   version_manager       - binary lifecycle management for CLI tools (CLIProxyAPI, etc.)
--   upstream_proxy_config - per-provider routing mode (native vs CLIProxyAPI vs fallback)

-- --------------------------------------------------------------------------
-- Table: version_manager
-- Tracks installed versions, process state, and update settings for
-- externally managed CLI tools (initially CLIProxyAPI).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS version_manager (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tool              TEXT NOT NULL UNIQUE,
  current_version   TEXT,
  installed_version TEXT,
  pinned_version    TEXT,
  binary_path       TEXT,
  status            TEXT NOT NULL DEFAULT 'not_installed',
  pid               INTEGER,
  port              INTEGER DEFAULT 8317,
  api_key           TEXT,
  management_key    TEXT,
  auto_update       INTEGER NOT NULL DEFAULT 1,
  auto_start        INTEGER NOT NULL DEFAULT 0,
  last_health_check TEXT,
  last_update_check TEXT,
  health_status     TEXT DEFAULT 'unknown',
  config_overrides  TEXT,
  error_message     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------------------
-- Table: upstream_proxy_config
-- Per-provider routing configuration for CLIProxyAPI passthrough mode.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upstream_proxy_config (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id               TEXT NOT NULL UNIQUE,
  mode                      TEXT NOT NULL DEFAULT 'native',
  cliproxyapi_model_mapping TEXT,
  native_priority           INTEGER NOT NULL DEFAULT 1,
  cliproxyapi_priority      INTEGER NOT NULL DEFAULT 2,
  enabled                   INTEGER NOT NULL DEFAULT 1,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_upc_provider ON upstream_proxy_config(provider_id);
CREATE INDEX IF NOT EXISTS idx_upc_mode ON upstream_proxy_config(mode);
CREATE INDEX IF NOT EXISTS idx_vm_tool ON version_manager(tool);
CREATE INDEX IF NOT EXISTS idx_vm_status ON version_manager(status);
