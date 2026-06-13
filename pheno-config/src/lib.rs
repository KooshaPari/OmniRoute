//! # pheno-config
//!
//! Canonical typed-configuration loader for the `pheno-*` fleet.
//! Provides three ways to materialise a [`Config`]:
//!
//! 1. [`load_from_env`] — reads `<PREFIX>_*` environment variables and
//!    parses them into a typed [`Config`]. Required fields
//!    (`URL`, `DB_PATH`) yield [`ConfigError::MissingField`]; bad
//!    numeric values (e.g. non-`u16` `PORT`) yield
//!    [`ConfigError::ParseError`].
//! 2. [`load_from_file`] — reads a JSON file via `serde_json` and
//!    deserialises it into a [`Config`]. File-read errors map to
//!    [`ConfigError::IoError`]; malformed JSON or type mismatches
//!    map to [`ConfigError::ParseError`].
//! 3. [`ConfigBuilder`] — programmatic construction with sensible
//!    defaults (`port = 8080`, `log_level = "info"`,
//!    `feature_flags = Vec::new()`). Used by tests and by consumers
//!    that already have all values in memory.
//!
//! ## Design
//!
//! - 3-variant [`ConfigError`] built on [`thiserror`] (no `anyhow`
//!   boundary to keep the dependency surface tiny).
//! - Deliberately a closed `enum` (no `#[non_exhaustive]`) so
//!   downstream `match` exhaustiveness checks are useful.
//! - Crate is **standalone**: an empty `[workspace]` table in its
//!   own `Cargo.toml` keeps it out of the root 56-crate workspace,
//!   matching the L3 #46 (`pheno-errors`) pattern. Consumers add
//!   it to their own workspace or depend on it via a path/git
//!   dependency.
//! - `Config` derives `Serialize`/`Deserialize` so the same struct
//!   round-trips through JSON, env, and builder without any
//!   translation layer.
//!
//! ## Consumers
//!
//! Consumed by L5 #81–85 across the `pheno-*` fleet as the single
//! source of truth for runtime configuration. See
//! `V3_EXECUTION_LOG_2026_06_10.md` → "L3 #48" for rollout notes.
//!
//! ## Example
//!
//! ```
//! use pheno_config::ConfigBuilder;
//!
//! let cfg = ConfigBuilder::new()
//!     .url("https://example.com")
//!     .db_path("/var/lib/app.db")
//!     .port(9090)
//!     .log_level("debug")
//!     .feature_flag("beta")
//!     .build()
//!     .expect("config");
//! assert_eq!(cfg.port, 9090);
//! assert_eq!(cfg.feature_flags, vec!["beta".to_string()]);
//! ```
//!
//! For env-var loading, see [`load_from_env`]; for JSON file
//! loading, see [`load_from_file`].

use std::env;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/// Errors produced by [`load_from_env`], [`load_from_file`], and
/// [`ConfigBuilder::build`]. Deliberately a closed 3-variant enum so
/// downstream `match` exhaustiveness checks are useful.
#[derive(Debug, Error)]
pub enum ConfigError {
    /// A required field (env var or JSON key) was missing.
    ///
    /// Returned when `<PREFIX>_URL` or `<PREFIX>_DB_PATH` is unset
    /// in the environment, or when a JSON config file is missing a
    /// required key.
    #[error("missing required config field: {0}")]
    MissingField(String),

    /// A value was present but could not be parsed into the target
    /// type (e.g. `<PREFIX>_PORT=not-a-number`, malformed JSON,
    /// wrong type in a JSON field).
    #[error("failed to parse config value for `{field}`: {message}")]
    ParseError {
        /// Name of the field that failed to parse (e.g. `"PORT"`,
        /// `"<json>"`).
        field: String,
        /// Human-readable parse failure detail.
        message: String,
    },

    /// An I/O error occurred while reading a config file from disk.
    ///
    /// `std::io::Error` is wrapped via `#[from]` so any fallible
    /// `std::fs` call inside `load_from_file` propagates naturally
    /// with the `?` operator.
    #[error("config I/O error: {0}")]
    IoError(#[from] std::io::Error),
}

/// `Result<T, ConfigError>` — the canonical return type for
/// fallible config-loading functions in the `pheno-*` fleet.
pub type Result<T> = std::result::Result<T, ConfigError>;

// ---------------------------------------------------------------------------
// Config struct
// ---------------------------------------------------------------------------

/// The canonical typed runtime configuration consumed by every
/// `pheno-*` service.
///
/// Derives `Serialize`/`Deserialize` so the same struct round-trips
/// through:
/// - [`load_from_file`] (JSON deserialisation)
/// - [`Config`] → JSON (e.g. for logging the effective config at
///   startup)
/// - builder construction
///
/// Field semantics:
/// - [`Config::url`] — service base URL (required).
/// - [`Config::port`] — service listen port. Defaults to `8080`.
/// - [`Config::log_level`] — tracing/log filter level. Defaults to
///   `"info"`. Validated as a non-empty string; downstream crates
///   (e.g. `pheno-tracing`) do the `tracing::Level` parse.
/// - [`Config::db_path`] — on-disk database path (required).
/// - [`Config::feature_flags`] — list of opt-in feature toggles.
///   Defaults to empty.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Config {
    /// Service base URL (required).
    pub url: String,
    /// Service listen port. Defaults to `8080`.
    pub port: u16,
    /// Tracing/log filter level. Defaults to `"info"`.
    pub log_level: String,
    /// On-disk database path (required).
    pub db_path: String,
    /// List of opt-in feature toggles. Defaults to `Vec::new()`.
    #[serde(default)]
    pub feature_flags: Vec<String>,
}

// ---------------------------------------------------------------------------
// Env-var name constants
// ---------------------------------------------------------------------------

/// Field name for [`Config::url`] (also the JSON key and env-var
/// suffix).
pub const FIELD_URL: &str = "URL";
/// Field name for [`Config::port`].
pub const FIELD_PORT: &str = "PORT";
/// Field name for [`Config::log_level`].
pub const FIELD_LOG_LEVEL: &str = "LOG_LEVEL";
/// Field name for [`Config::db_path`].
pub const FIELD_DB_PATH: &str = "DB_PATH";
/// Field name for [`Config::feature_flags`].
pub const FIELD_FEATURE_FLAGS: &str = "FEATURE_FLAGS";

fn env_name(prefix: &str, field: &str) -> String {
    format!("{prefix}_{field}")
}

fn parse_feature_flags(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect()
}

// ---------------------------------------------------------------------------
// load_from_env
// ---------------------------------------------------------------------------

/// Loads a [`Config`] from environment variables matching
/// `<prefix>_*`.
///
/// The expected env-var names are (substituting `<prefix>`):
/// - `<prefix>_URL` — required → [`ConfigError::MissingField`] when
///   unset.
/// - `<prefix>_PORT` — optional `u16`; defaults to `8080`.
///   Non-numeric values produce [`ConfigError::ParseError`].
/// - `<prefix>_LOG_LEVEL` — optional string; defaults to `"info"`.
/// - `<prefix>_DB_PATH` — required → [`ConfigError::MissingField`]
///   when unset.
/// - `<prefix>_FEATURE_FLAGS` — optional comma-separated string;
///   defaults to `Vec::new()`. Whitespace around each flag is
///   trimmed; empty entries are dropped.
///
/// Environment variables not matching `<prefix>_*` are ignored
/// (this is verified by the
/// `load_from_env_with_prefix_filters_unrelated_vars` test).
///
/// # Errors
///
/// - [`ConfigError::MissingField`] when a required env var
///   (`<PREFIX>_URL` or `<PREFIX>_DB_PATH`) is unset.
/// - [`ConfigError::ParseError`] when `<PREFIX>_PORT` is set but
///   not a valid `u16`.
pub fn load_from_env(prefix: &str) -> Result<Config> {
    // Required: URL
    let url = match env::var(env_name(prefix, FIELD_URL)) {
        Ok(v) => v,
        Err(env::VarError::NotPresent) => {
            return Err(ConfigError::MissingField(env_name(prefix, FIELD_URL)));
        }
        Err(env::VarError::NotUnicode(_)) => {
            return Err(ConfigError::ParseError {
                field: env_name(prefix, FIELD_URL),
                message: "env value is not valid unicode".to_owned(),
            });
        }
    };

    // Optional with default: PORT
    let port = match env::var(env_name(prefix, FIELD_PORT)) {
        Ok(raw) => raw.parse::<u16>().map_err(|e| ConfigError::ParseError {
            field: env_name(prefix, FIELD_PORT),
            message: e.to_string(),
        })?,
        Err(env::VarError::NotPresent) => 8080_u16,
        Err(env::VarError::NotUnicode(_)) => {
            return Err(ConfigError::ParseError {
                field: env_name(prefix, FIELD_PORT),
                message: "env value is not valid unicode".to_owned(),
            });
        }
    };

    // Optional with default: LOG_LEVEL
    let log_level = match env::var(env_name(prefix, FIELD_LOG_LEVEL)) {
        Ok(v) if !v.is_empty() => v,
        Ok(_) => String::from("info"),
        Err(env::VarError::NotPresent) => String::from("info"),
        Err(env::VarError::NotUnicode(_)) => {
            return Err(ConfigError::ParseError {
                field: env_name(prefix, FIELD_LOG_LEVEL),
                message: "env value is not valid unicode".to_owned(),
            });
        }
    };

    // Required: DB_PATH
    let db_path = match env::var(env_name(prefix, FIELD_DB_PATH)) {
        Ok(v) => v,
        Err(env::VarError::NotPresent) => {
            return Err(ConfigError::MissingField(env_name(prefix, FIELD_DB_PATH)));
        }
        Err(env::VarError::NotUnicode(_)) => {
            return Err(ConfigError::ParseError {
                field: env_name(prefix, FIELD_DB_PATH),
                message: "env value is not valid unicode".to_owned(),
            });
        }
    };

    // Optional with default: FEATURE_FLAGS (comma-separated)
    let feature_flags = match env::var(env_name(prefix, FIELD_FEATURE_FLAGS)) {
        Ok(raw) => parse_feature_flags(&raw),
        Err(env::VarError::NotPresent) => Vec::new(),
        Err(env::VarError::NotUnicode(_)) => {
            return Err(ConfigError::ParseError {
                field: env_name(prefix, FIELD_FEATURE_FLAGS),
                message: "env value is not valid unicode".to_owned(),
            });
        }
    };

    Ok(Config {
        url,
        port,
        log_level,
        db_path,
        feature_flags,
    })
}

// ---------------------------------------------------------------------------
// load_from_file
// ---------------------------------------------------------------------------

/// Loads a [`Config`] from a JSON file on disk.
///
/// The file is read in full and deserialised via `serde_json`. File
/// I/O errors propagate as [`ConfigError::IoError`] (via the
/// `#[from] std::io::Error` impl). Malformed JSON or type
/// mismatches are mapped to [`ConfigError::ParseError`]. Missing
/// required JSON keys are mapped to [`ConfigError::MissingField`]
/// when serde_json's error classifies the failure as a data-shape
/// problem (i.e. `is_data()`) and the message contains
/// `"missing field"`.
pub fn load_from_file(path: &Path) -> Result<Config> {
    let bytes = std::fs::read(path)?;
    let cfg: Config = serde_json::from_slice(&bytes).map_err(|e| {
        if e.is_data() {
            // serde_json reports "missing field `name`" for absent
            // required keys. Sniff the field name out of the message
            // so consumers get a structured MissingField error.
            let msg = e.to_string();
            if let Some(field) = extract_missing_field_name(&msg) {
                ConfigError::MissingField(field)
            } else {
                ConfigError::ParseError {
                    field: "<json>".to_owned(),
                    message: msg,
                }
            }
        } else {
            ConfigError::ParseError {
                field: "<json>".to_owned(),
                message: e.to_string(),
            }
        }
    })?;
    Ok(cfg)
}

/// Best-effort extraction of the missing-field name from a
/// serde_json error message. serde_json produces messages of the
/// form: `missing field \`name\` at line N column M`.
fn extract_missing_field_name(msg: &str) -> Option<String> {
    let marker = "missing field `";
    let start = msg.find(marker)? + marker.len();
    let rest = &msg[start..];
    let end = rest.find('`')?;
    Some(rest[..end].to_owned())
}

// ---------------------------------------------------------------------------
// ConfigBuilder
// ---------------------------------------------------------------------------

/// Programmatic [`Config`] construction with sensible defaults.
///
/// Defaults:
/// - `port = 8080`
/// - `log_level = "info"`
/// - `feature_flags = Vec::new()`
/// - `url` and `db_path` are unset (required).
///
/// # Example
///
/// ```
/// use pheno_config::ConfigBuilder;
///
/// let cfg = ConfigBuilder::new()
///     .url("https://example.com")
///     .db_path("/var/lib/app.db")
///     .port(9090)
///     .log_level("debug")
///     .feature_flag("beta")
///     .build()
///     .expect("config");
/// assert_eq!(cfg.port, 9090);
/// assert_eq!(cfg.feature_flags, vec!["beta".to_string()]);
/// ```
#[derive(Debug, Clone)]
pub struct ConfigBuilder {
    url: Option<String>,
    port: u16,
    log_level: String,
    db_path: Option<String>,
    feature_flags: Vec<String>,
}

impl Default for ConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigBuilder {
    /// Default `port = 8080`, `log_level = "info"`,
    /// `feature_flags = Vec::new()`. `url` and `db_path` are
    /// `None` and must be set before [`Self::build`].
    #[must_use]
    pub fn new() -> Self {
        Self {
            url: None,
            port: 8080,
            log_level: String::from("info"),
            db_path: None,
            feature_flags: Vec::new(),
        }
    }

    /// Sets the service base URL (required).
    #[must_use]
    pub fn url(mut self, url: impl Into<String>) -> Self {
        self.url = Some(url.into());
        self
    }

    /// Sets the service listen port. Default `8080`.
    #[must_use]
    pub fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    /// Sets the tracing/log filter level. Default `"info"`.
    #[must_use]
    pub fn log_level(mut self, log_level: impl Into<String>) -> Self {
        self.log_level = log_level.into();
        self
    }

    /// Sets the on-disk database path (required).
    #[must_use]
    pub fn db_path(mut self, db_path: impl Into<String>) -> Self {
        self.db_path = Some(db_path.into());
        self
    }

    /// Appends a single feature flag.
    #[must_use]
    pub fn feature_flag(mut self, flag: impl Into<String>) -> Self {
        self.feature_flags.push(flag.into());
        self
    }

    /// Replaces the entire feature-flag list. Useful for
    /// propagating flags from a higher-level config source.
    #[must_use]
    pub fn feature_flags(mut self, flags: impl IntoIterator<Item = impl Into<String>>) -> Self {
        self.feature_flags = flags.into_iter().map(Into::into).collect();
        self
    }

    /// Materialises a [`Config`].
    ///
    /// # Errors
    ///
    /// Returns [`ConfigError::MissingField`] for any unset required
    /// field (`URL` or `DB_PATH`).
    pub fn build(self) -> Result<Config> {
        let url = self
            .url
            .ok_or_else(|| ConfigError::MissingField(FIELD_URL.to_owned()))?;
        let db_path = self
            .db_path
            .ok_or_else(|| ConfigError::MissingField(FIELD_DB_PATH.to_owned()))?;
        Ok(Config {
            url,
            port: self.port,
            log_level: self.log_level,
            db_path,
            feature_flags: self.feature_flags,
        })
    }
}

// ---------------------------------------------------------------------------
// Tests live in `tests/config_test.rs` (integration tests against the
// public API). The six L3 #48 spec-named tests are there verbatim:
// `load_from_env_with_prefix_filters_unrelated_vars`,
// `load_from_env_defaults_port_8080`, `load_from_file_valid_json`,
// `load_from_file_missing_file_returns_io_error`,
// `builder_sets_defaults`, and `missing_required_field_returns_missing_field_error`.
// ---------------------------------------------------------------------------
