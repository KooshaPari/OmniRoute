//! Runtime configuration for OmniRoute.
//!
//! `Config` is loaded once at startup and treated as immutable after. The
//! canonical loader is [`Config::load`], which:
//! 1. Sources from a layered base: builder defaults → `.env` file (optional) →
//!    process env vars → explicit overrides via the builder.
//! 2. Validates the result via [`Config::validate`] (zero/negative durations,
//!    bad URLs, etc.).
//!
//! Sensible fallbacks are baked in:
//! - data dir: `$OMNIROUTE_DATA_DIR` → `$DATA_DIR` → `$HOME/.omniroute` → `.omniroute`
//! - database URL: `sqlite://<data_dir>/storage.sqlite`
//! - bind: `127.0.0.1:9090`
//! - provider timeout: 60s
//! - stream idle timeout: 120s
//!
//! D-omni decisions baked in as defaults (per the 2026-07-05 plan):
//! - **D-omni-04** — SQLite-only: `database_url` defaults to a sqlite URL.
//! - **D-omni-05** — Chaos engineering: `chaos` section present and enabled-able.
//! - **D-omni-08** — OpenCode plugin as first-class consumer: `opencode`
//!   section present and pinned to v1 contract.
//! - **D-omni-09** — TUI + tray in CLI: CLI is allowed to opt in to interactive mode.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// Resolved OmniRoute runtime config. Loaded once at startup, immutable after.
#[derive(Debug, Clone)]
pub struct Config {
    pub data_dir: DataDir,
    pub bind: BindConfig,
    pub log: LogConfig,
    pub database_url: String,
    pub provider_timeout: Duration,
    pub stream_idle_timeout: Duration,
    pub mcp: McpConfig,
    pub a2a: A2aConfig,
    pub telemetry: TelemetryConfig,
    pub providers: ProvidersConfig,
    pub compression: CompressionConfig,
    pub chaos: ChaosConfig,
    pub opencode: OpenCodeConfig,
}

/// Resolved filesystem layout under `data_dir`.
#[derive(Debug, Clone)]
pub struct DataDir {
    pub root: PathBuf,
    pub db_file: PathBuf,
    pub env_file: PathBuf,
    pub log_file: PathBuf,
}

impl DataDir {
    /// Resolve the standard layout from a root path.
    #[must_use]
    pub fn resolve(root: PathBuf) -> Self {
        Self {
            db_file: root.join("storage.sqlite"),
            env_file: root.join(".env"),
            log_file: root.join("omniroute.log"),
            root,
        }
    }

    /// Ensure the data directory exists. Idempotent.
    pub fn ensure(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.root)
    }
}

#[derive(Debug, Clone)]
pub struct BindConfig {
    pub host: String,
    pub port: u16,
    pub max_body_bytes: usize,
}

impl Default for BindConfig {
    fn default() -> Self {
        Self {
            host: std::env::var("OMNIROUTE_BIND_HOST").unwrap_or_else(|_| "127.0.0.1".into()),
            port: std::env::var("OMNIROUTE_BIND_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(9090),
            max_body_bytes: 64 * 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone)]
pub struct LogConfig {
    pub level: LogLevel,
    pub format: LogFormat,
    pub file: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl Default for LogLevel {
    fn default() -> Self {
        match std::env::var("OMNIROUTE_LOG_LEVEL").as_deref() {
            Ok("trace") => Self::Trace,
            Ok("debug") => Self::Debug,
            Ok("info") => Self::Info,
            Ok("warn" | "warning") => Self::Warn,
            Ok("error") => Self::Error,
            _ => Self::Info,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    Pretty,
    Json,
}

impl Default for LogFormat {
    fn default() -> Self {
        match std::env::var("OMNIROUTE_LOG_FORMAT").as_deref() {
            Ok("json") => Self::Json,
            _ => Self::Pretty,
        }
    }
}

#[derive(Debug, Clone)]
pub struct McpConfig {
    pub enabled: bool,
    pub enforce_scopes: bool,
    pub tool_description_compression: bool,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: env_flag_default_true("OMNIROUTE_MCP_ENABLED"),
            enforce_scopes: env_flag_default_true("OMNIROUTE_MCP_ENFORCE_SCOPES"),
            tool_description_compression: env_flag_default_true(
                "OMNIROUTE_MCP_TOOL_DESCRIPTION_COMPRESSION",
            ),
        }
    }
}

#[derive(Debug, Clone)]
pub struct A2aConfig {
    pub enabled: bool,
    pub card_path: String,
}

impl Default for A2aConfig {
    fn default() -> Self {
        Self {
            enabled: env_flag_default_true("OMNIROUTE_A2A_ENABLED"),
            card_path: std::env::var("OMNIROUTE_A2A_CARD_PATH")
                .unwrap_or_else(|_| "/.well-known/agent.json".into()),
        }
    }
}

#[derive(Debug, Clone)]
pub struct TelemetryConfig {
    pub otlp_endpoint: Option<String>,
    pub service_name: String,
    pub trace_sample_ratio: f64,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            otlp_endpoint: std::env::var("OMNIROUTE_OTLP_ENDPOINT").ok(),
            service_name: std::env::var("OMNIROUTE_SERVICE_NAME")
                .unwrap_or_else(|_| "omniroute".into()),
            trace_sample_ratio: std::env::var("OMNIROUTE_TRACE_SAMPLE_RATIO")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.0),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProvidersConfig {
    pub default_provider: String,
    pub fallback_chain: Vec<String>,
    pub max_retries: u32,
    pub retry_base_ms: u64,
    pub rate_limit_per_minute: u32,
}

impl Default for ProvidersConfig {
    fn default() -> Self {
        Self {
            default_provider: std::env::var("OMNIROUTE_DEFAULT_PROVIDER")
                .unwrap_or_else(|_| "default".into()),
            fallback_chain: std::env::var("OMNIROUTE_FALLBACK_CHAIN")
                .ok()
                .map(|s| s.split(',').map(|p| p.trim().to_string()).collect())
                .filter(|v: &Vec<String>| !v.is_empty())
                .unwrap_or_else(|| vec!["default".into()]),
            max_retries: std::env::var("OMNIROUTE_PROVIDER_MAX_RETRIES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(2),
            retry_base_ms: std::env::var("OMNIROUTE_PROVIDER_RETRY_BASE_MS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(250),
            rate_limit_per_minute: std::env::var("OMNIROUTE_PROVIDER_RATE_LIMIT_RPM")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(60),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CompressionConfig {
    pub enabled: bool,
    pub mode: String, // "off" | "rtk" | "caveman" | "aggressive" | "adaptive"
    pub budget_ratio: f64,
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            enabled: env_flag("OMNIROUTE_COMPRESSION_ENABLED", false),
            mode: std::env::var("OMNIROUTE_COMPRESSION_MODE")
                .unwrap_or_else(|_| "off".into()),
            budget_ratio: std::env::var("OMNIROUTE_COMPRESSION_BUDGET_RATIO")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.5),
        }
    }
}

/// Chaos engineering config (D-omni-05: yes in scope).
#[derive(Debug, Clone)]
pub struct ChaosConfig {
    pub enabled: bool,
    pub latency_inject_pct: f64,
    pub error_inject_pct: f64,
    pub kill_provider_pct: f64,
}

impl Default for ChaosConfig {
    fn default() -> Self {
        Self {
            enabled: env_flag("OMNIROUTE_CHAOS_ENABLED", false),
            latency_inject_pct: env_f64("OMNIROUTE_CHAOS_LATENCY_PCT", 0.0),
            error_inject_pct: env_f64("OMNIROUTE_CHAOS_ERROR_PCT", 0.0),
            kill_provider_pct: env_f64("OMNIROUTE_CHAOS_KILL_PCT", 0.0),
        }
    }
}

/// OpenCode plugin config (D-omni-08: first-class consumer).
#[derive(Debug, Clone)]
pub struct OpenCodeConfig {
    pub enabled: bool,
    /// Pinned contract version (PR-2 will lock this at "v1").
    pub contract_version: String,
    pub catalog_endpoint: String,
}

impl Default for OpenCodeConfig {
    fn default() -> Self {
        Self {
            enabled: env_flag_default_true("OMNIROUTE_OPENCODE_ENABLED"),
            contract_version: std::env::var("OMNIROUTE_OPENCODE_CONTRACT_VERSION")
                .unwrap_or_else(|_| "v1".into()),
            catalog_endpoint: std::env::var("OMNIROUTE_OPENCODE_CATALOG_ENDPOINT")
                .unwrap_or_else(|_| "/v1/models".into()),
        }
    }
}

impl Config {
    /// Start a fresh builder with defaults applied.
    #[must_use]
    pub fn builder() -> ConfigBuilder {
        ConfigBuilder::default()
    }

    /// Load config from defaults + `.env` + process env.
    ///
    /// 1. Sources `Config::default()`.
    /// 2. If `data_dir/env_file` exists, dotenvy loads it (existing process
    ///    env vars take precedence; this only fills missing slots).
    /// 3. Re-applies env-driven sub-defaults by re-constructing from
    ///    `Self::default()` after the dotenv load (the env-driven
    ///    `Default` impls pick up the freshly-loaded vars).
    /// 4. Calls `validate()`.
    pub fn load() -> crate::error::Result<Self> {
        let cfg = Self::default();
        let env_path = cfg.data_dir.env_file.clone();
        if env_path.exists() {
            // dotenvy::from_path is non-fatal when the file is missing; we
            // gate on existence ourselves so we can avoid noisy logs in the
            // default install.
            // `from_path` overwrites nothing — existing process env wins.
            if let Err(e) = dotenvy::from_path(&env_path) {
                tracing::warn!(
                    path = %env_path.display(),
                    error = %e,
                    "failed to load .env; continuing with process env"
                );
            }
        }
        // Re-apply env-driven defaults so anything dotenvy just set is picked
        // up by the sub-component `Default` impls.
        let cfg = Self::default();
        cfg.validate()?;
        Ok(cfg)
    }

    /// Validate structural invariants. Returns [`Error::Config`] on failure.
    pub fn validate(&self) -> crate::error::Result<()> {
        use crate::error::{Error, ErrorKind};

        if self.provider_timeout.is_zero() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "provider_timeout must be > 0",
            ));
        }
        if self.stream_idle_timeout.is_zero() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "stream_idle_timeout must be > 0",
            ));
        }
        if self.providers.max_retries > 16 {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "providers.max_retries must be <= 16",
            ));
        }
        if self.bind.port == 0 {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "bind.port must be > 0",
            ));
        }
        if self.compression.budget_ratio < 0.0 || self.compression.budget_ratio > 1.0 {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "compression.budget_ratio must be in [0, 1]",
            ));
        }
        if !(0.0..=1.0).contains(&self.telemetry.trace_sample_ratio) {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "telemetry.trace_sample_ratio must be in [0, 1]",
            ));
        }
        for pct in [
            self.chaos.latency_inject_pct,
            self.chaos.error_inject_pct,
            self.chaos.kill_provider_pct,
        ] {
            if !pct.is_finite() || !(0.0..=1.0).contains(&pct) {
                return Err(Error::with_kind(
                    ErrorKind::ConfigInvalid,
                    "chaos percentages must be in [0, 1]",
                ));
            }
        }
        if !self.database_url.starts_with("sqlite://") {
            // D-omni-04: SQLite-only in v1.
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "database_url must be a sqlite:// URL (D-omni-04: SQLite-only in v1)",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Default)]
pub struct ConfigBuilder {
    inner: Config,
}

impl ConfigBuilder {
    pub fn data_dir(mut self, root: PathBuf) -> Self {
        self.inner.data_dir = DataDir::resolve(root);
        self.inner.database_url = format!("sqlite://{}", self.inner.data_dir.db_file.display());
        self
    }

    pub fn bind(mut self, host: impl Into<String>, port: u16) -> Self {
        self.inner.bind.host = host.into();
        self.inner.bind.port = port;
        self
    }

    pub fn log_level(mut self, lvl: LogLevel) -> Self {
        self.inner.log.level = lvl;
        self
    }

    pub fn log_format(mut self, fmt: LogFormat) -> Self {
        self.inner.log.format = fmt;
        self
    }

    pub fn provider_timeout(mut self, d: Duration) -> Self {
        self.inner.provider_timeout = d;
        self
    }

    pub fn stream_idle_timeout(mut self, d: Duration) -> Self {
        self.inner.stream_idle_timeout = d;
        self
    }

    pub fn mcp_enabled(mut self, enabled: bool) -> Self {
        self.inner.mcp.enabled = enabled;
        self
    }

    pub fn a2a_enabled(mut self, enabled: bool) -> Self {
        self.inner.a2a.enabled = enabled;
        self
    }

    pub fn compression_enabled(mut self, enabled: bool) -> Self {
        self.inner.compression.enabled = enabled;
        self
    }

    pub fn chaos_enabled(mut self, enabled: bool) -> Self {
        self.inner.chaos.enabled = enabled;
        self
    }

    pub fn opencode_contract_version(mut self, v: impl Into<String>) -> Self {
        self.inner.opencode.contract_version = v.into();
        self
    }

    pub fn database_url(mut self, url: impl Into<String>) -> Self {
        self.inner.database_url = url.into();
        self
    }

    pub fn build(self) -> crate::error::Result<Config> {
        let cfg = self.inner;
        cfg.validate()?;
        Ok(cfg)
    }
}

/// Try to resolve a sensible data dir, mirroring the TS fork's behaviour.
#[must_use]
pub fn default_data_dir() -> PathBuf {
    if let Ok(env) = std::env::var("OMNIROUTE_DATA_DIR") {
        return PathBuf::from(env);
    }
    if let Ok(env) = std::env::var("DATA_DIR") {
        return PathBuf::from(env);
    }
    if let Some(home) = dirs_home() {
        return home.join(".omniroute");
    }
    PathBuf::from(".omniroute")
}

fn dirs_home() -> Option<PathBuf> {
    if let Ok(h) = std::env::var("HOME") {
        return Some(PathBuf::from(h));
    }
    if let Ok(p) = std::env::var("USERPROFILE") {
        return Some(PathBuf::from(p));
    }
    None
}

fn env_flag(name: &str, default: bool) -> bool {
    match std::env::var(name).as_deref() {
        Ok("1" | "true" | "TRUE" | "yes" | "on") => true,
        Ok("0" | "false" | "FALSE" | "no" | "off" | "") => false,
        _ => default,
    }
}

fn env_flag_default_true(name: &str) -> bool {
    env_flag(name, true)
}

fn env_f64(name: &str, default: f64) -> f64 {
    std::env::var(name).ok().and_then(|s| s.parse().ok()).unwrap_or(default)
}

/// Helper: write a `.env` template to disk under a data dir, idempotent.
///
/// Used by the init command; exposed here so tests can rely on it.
pub fn write_default_env_at(dir: &Path) -> std::io::Result<()> {
    let path = dir.join(".env");
    if path.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(dir)?;
    std::fs::write(
        &path,
        "# OmniRoute .env — overrides per process env (process env wins)\n\
         OMNIROUTE_LOG_LEVEL=info\n\
         OMNIROUTE_BIND_HOST=127.0.0.1\n\
         OMNIROUTE_BIND_PORT=9090\n\
         # D-omni-04: SQLite-only in v1\n\
         OMNIROUTE_DATABASE_URL=sqlite://./storage.sqlite\n",
    )
}

impl Default for Config {
    fn default() -> Self {
        let data_dir = DataDir::resolve(default_data_dir());
        let database_url = std::env::var("OMNIROUTE_DATABASE_URL")
            .unwrap_or_else(|_| format!("sqlite://{}", data_dir.db_file.display()));
        Self {
            data_dir,
            bind: BindConfig::default(),
            log: LogConfig { level: LogLevel::default(), format: LogFormat::default(), file: None },
            database_url,
            provider_timeout: env_duration_secs("OMNIROUTE_PROVIDER_TIMEOUT", 60),
            stream_idle_timeout: env_duration_secs("OMNIROUTE_STREAM_IDLE_TIMEOUT", 120),
            mcp: McpConfig::default(),
            a2a: A2aConfig::default(),
            telemetry: TelemetryConfig::default(),
            providers: ProvidersConfig::default(),
            compression: CompressionConfig::default(),
            chaos: ChaosConfig::default(),
            opencode: OpenCodeConfig::default(),
        }
    }
}

fn env_duration_secs(name: &str, default_secs: u64) -> Duration {
    std::env::var(name).ok().and_then(|s| s.parse().ok()).map(Duration::from_secs).unwrap_or_else(|| Duration::from_secs(default_secs))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_dir_resolve_lays_out_canonical_files() {
        let d = DataDir::resolve(PathBuf::from("/tmp/or-test"));
        assert_eq!(d.root, PathBuf::from("/tmp/or-test"));
        assert_eq!(d.db_file, PathBuf::from("/tmp/or-test/storage.sqlite"));
        assert_eq!(d.env_file, PathBuf::from("/tmp/or-test/.env"));
        assert_eq!(d.log_file, PathBuf::from("/tmp/or-test/omniroute.log"));
    }

    #[test]
    fn config_default_validates() {
        let cfg = Config::default();
        cfg.validate().expect("default config must validate");
    }

    #[test]
    fn config_rejects_non_sqlite_url() {
        let mut cfg = Config::default();
        cfg.database_url = "postgres://localhost/db".into();
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn config_rejects_zero_provider_timeout() {
        let mut cfg = Config::default();
        cfg.provider_timeout = Duration::from_secs(0);
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn config_rejects_out_of_range_budget_ratio() {
        let mut cfg = Config::default();
        cfg.compression.budget_ratio = 1.5;
        let err = cfg.validate().unwrap_err();
        assert_eq!(err.kind(), crate::error::ErrorKind::ConfigInvalid);
    }

    #[test]
    fn config_rejects_out_of_range_chaos_pct() {
        let mut cfg = Config::default();
        cfg.chaos.error_inject_pct = 1.5;
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn config_rejects_bind_port_zero() {
        let cfg = Config::builder()
            .data_dir(PathBuf::from("/tmp/or-test"))
            .bind("127.0.0.1", 0)
            .build();
        assert!(cfg.is_err());
    }

    #[test]
    fn env_flag_truthy_and_falsy() {
        assert!(env_flag("_OR_TEST_FLAG", true));
        assert!(!env_flag("_OR_TEST_FLAG", false));
    }

    #[test]
    fn chaos_and_opencode_defaults_present() {
        let cfg = Config::default();
        assert!(!cfg.chaos.enabled);
        assert_eq!(cfg.opencode.contract_version, "v1");
    }

    #[test]
    fn builder_overrides_apply() {
        let cfg = Config::builder()
            .data_dir(PathBuf::from("/tmp/or-override"))
            .bind("0.0.0.0", 8080)
            .chaos_enabled(true)
            .opencode_contract_version("v2")
            .build()
            .unwrap();
        assert_eq!(cfg.bind.host, "0.0.0.0");
        assert_eq!(cfg.bind.port, 8080);
        assert!(cfg.chaos.enabled);
        assert_eq!(cfg.opencode.contract_version, "v2");
    }

}
