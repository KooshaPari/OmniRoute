use std::path::PathBuf;
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
}

#[derive(Debug, Clone)]
pub struct DataDir {
    pub root: PathBuf,
    pub db_file: PathBuf,
    pub env_file: PathBuf,
    pub log_file: PathBuf,
}

impl DataDir {
    pub fn resolve(root: PathBuf) -> Self {
        Self {
            db_file: root.join("storage.sqlite"),
            env_file: root.join(".env"),
            log_file: root.join("omniroute.log"),
            root,
        }
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
            host: "127.0.0.1".into(),
            port: 9090,
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
        Self::Info
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
        Self::Pretty
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
            enabled: true,
            enforce_scopes: true,
            tool_description_compression: true,
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
        Self { enabled: true, card_path: "/.well-known/agent.json".into() }
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
            otlp_endpoint: None,
            service_name: "omniroute".into(),
            trace_sample_ratio: 0.0,
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
            default_provider: "default".into(),
            fallback_chain: vec!["default".into()],
            max_retries: 2,
            retry_base_ms: 250,
            rate_limit_per_minute: 60,
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
        Self { enabled: false, mode: "off".into(), budget_ratio: 0.5 }
    }
}

impl Config {
    pub fn builder() -> ConfigBuilder {
        ConfigBuilder::default()
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
    pub fn build(self) -> Config {
        self.inner
    }
}

/// Try to resolve a sensible data dir, mirroring the TS fork's behaviour.
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

impl Default for Config {
    fn default() -> Self {
        Self {
            data_dir: DataDir::resolve(default_data_dir()),
            bind: BindConfig::default(),
            log: LogConfig { level: LogLevel::default(), format: LogFormat::default(), file: None },
            database_url: format!("sqlite://{}", default_data_dir().join("storage.sqlite").display()),
            provider_timeout: Duration::from_secs(60),
            stream_idle_timeout: Duration::from_secs(120),
            mcp: McpConfig::default(),
            a2a: A2aConfig::default(),
            telemetry: TelemetryConfig::default(),
            providers: ProvidersConfig::default(),
            compression: CompressionConfig::default(),
        }
    }
}
