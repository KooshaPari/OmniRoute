//! Configuration management for sharecli
//!
//! All configurable parameters are consolidated here. Hardcoded defaults
//! serve as fallbacks when no config file is present; users override via
//! `~/.config/sharecli/config.toml`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::OnceLock;

use anyhow::Result;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Top-level Config
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    /// Registered projects (name → path)
    pub projects: HashMap<String, String>,

    /// Runtime settings (executable paths, resource caps)
    pub runtime: RuntimeConfig,

    /// Default harness settings (per harness type)
    pub defaults: HashMap<String, DefaultHarnessConfig>,

    /// Shared process pool settings
    pub pool: PoolConfig,

    /// Monitoring / health-check thresholds
    pub monitoring: MonitoringConfig,

    /// Port assignments for co-processes
    pub port: PortConfig,

    /// Default paths for discovery, output, etc.
    pub paths: PathsConfig,

    /// Default project resource limits
    pub project_limits: ProjectLimitsConfig,

    /// Spawn / timing parameters
    pub spawn: SpawnConfig,

    /// Build-contention throttle policy
    pub spawn_policy: SpawnPolicyConfig,

    /// Cross-machine text-injection (`cast`) settings
    pub cast: CastConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            projects: default_projects(),
            runtime: RuntimeConfig::default(),
            defaults: default_harness_configs(),
            pool: PoolConfig::default(),
            monitoring: MonitoringConfig::default(),
            port: PortConfig::default(),
            paths: PathsConfig::default(),
            project_limits: ProjectLimitsConfig::default(),
            spawn: SpawnConfig::default(),
            spawn_policy: SpawnPolicyConfig::default(),
            cast: CastConfig::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// Sub-configs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    /// Path to node executable
    pub node_path: Option<String>,
    /// Path to bun executable
    pub bun_path: Option<String>,
    /// Maximum memory per process (MB)
    pub max_memory_mb: Option<u64>,
    /// Maximum number of processes
    pub max_processes: Option<usize>,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            node_path: None,
            bun_path: None,
            max_memory_mb: Some(4096),
            max_processes: Some(100),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    /// Enable shared process pool
    pub enabled: bool,
    /// Max pooled processes per harness type (node, bun)
    pub max_per_type: usize,
    /// Idle timeout before a pooled process is eligible for recycling (seconds)
    pub idle_timeout_secs: u64,
    /// Max age before a pooled process is force-recycled (seconds)
    pub max_age_secs: u64,
    /// Delay between spawn and health check (milliseconds)
    pub spawn_delay_ms: u64,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_per_type: 5,
            idle_timeout_secs: 300,
            max_age_secs: 3600,
            spawn_delay_ms: 100,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    /// Interval between health checks (seconds)
    pub health_check_interval_secs: u64,
    /// Seconds of inactivity before a process is considered idle
    pub idle_threshold_secs: u64,
    /// Memory threshold above which a warning is emitted (MB)
    pub high_memory_threshold_mb: u64,
    /// Number of idle processes that triggers a pruning recommendation
    pub idle_process_threshold: usize,
    /// Per-process memory limit for health-check warnings (bytes)
    pub per_process_warn_memory_bytes: u64,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            health_check_interval_secs: 30,
            idle_threshold_secs: 300,
            high_memory_threshold_mb: 4096,
            idle_process_threshold: 5,
            per_process_warn_memory_bytes: 1024 * 1024 * 1024, // 1 GiB
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortConfig {
    /// Port for the ShareWei co-process
    pub sharewei_port: u16,
}

impl Default for PortConfig {
    fn default() -> Self {
        Self { sharewei_port: 3100 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathsConfig {
    /// Default directory to scan when `project discover` has no argument
    pub discovery_path: String,
    /// Default output path for `project generate`
    pub default_compose_output: String,
}

impl Default for PathsConfig {
    fn default() -> Self {
        Self {
            discovery_path: "~/CodeProjects/Phenotype/repos".into(),
            default_compose_output: "process-compose.yml".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultHarnessConfig {
    pub enabled: bool,
    pub max_instances: usize,
    pub memory_limit_mb: u64,
}

impl Default for DefaultHarnessConfig {
    fn default() -> Self {
        Self { enabled: true, max_instances: 10, memory_limit_mb: 256 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectLimitsConfig {
    /// Default memory limit per project (MB)
    pub memory_limit_mb: u64,
    /// Default max processes per project
    pub max_processes: usize,
}

impl Default for ProjectLimitsConfig {
    fn default() -> Self {
        Self { memory_limit_mb: 1024, max_processes: 10 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnConfig {
    /// Default harness type when none is specified
    pub default_harness: String,
    /// Default idle threshold for prune command (seconds)
    pub prune_idle_seconds: u64,
}

impl Default for SpawnConfig {
    fn default() -> Self {
        Self { default_harness: "claude".into(), prune_idle_seconds: 300 }
    }
}

// ---------------------------------------------------------------------------
// Spawn-policy / build-contention throttle
// ---------------------------------------------------------------------------

/// Controls how sharecli-managed build harnesses (cargo/rustc) compete for CPU.
///
/// All settings are **opt-in**: defaults are conservative and safe. The policy
/// only affects processes that sharecli itself spawns — it never touches the
/// operator's existing sessions.
///
/// Add to `~/.config/sharecli/config.toml`:
///
/// ```toml
/// [spawn_policy]
/// nice_level = 10           # 0 = disabled; >0 = apply background QoS (macOS: taskpolicy -b)
/// max_concurrent_builds = 2 # semaphore cap across all sharecli build spawns
/// use_sccache = false       # set RUSTC_WRAPPER=sccache when sccache is on PATH
/// ```
///
/// Teardown: the semaphore is in-process only. When sharecli exits all permits
/// are released automatically; no persistent state is written.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SpawnPolicyConfig {
    /// nice/priority level applied to build harness processes via `taskpolicy -b`
    /// on macOS. Set to 0 to disable background-QoS wrapping entirely.
    pub nice_level: u8,
    /// Maximum number of cargo/rustc build harnesses that may execute
    /// concurrently under sharecli. Additional spawns queue until a slot is free.
    pub max_concurrent_builds: usize,
    /// When `true` and `sccache` is found on PATH, set `RUSTC_WRAPPER=sccache`
    /// for every build harness sharecli spawns.
    pub use_sccache: bool,
}

impl Default for SpawnPolicyConfig {
    fn default() -> Self {
        Self { nice_level: 10, max_concurrent_builds: 2, use_sccache: false }
    }
}

// ---------------------------------------------------------------------------
// Default projects (machine-local — overridden by config file)
// ---------------------------------------------------------------------------

fn default_projects() -> HashMap<String, String> {
    let mut projects = HashMap::new();
    projects
        .insert("helios-cli".to_string(), "~/CodeProjects/Phenotype/repos/helios-cli".to_string());
    projects.insert("portage".to_string(), "~/CodeProjects/Phenotype/repos/portage".to_string());
    projects.insert(
        "agentapi".to_string(),
        "~/CodeProjects/Phenotype/repos/agentapi-plusplus".to_string(),
    );
    projects.insert(
        "cliproxy".to_string(),
        "~/CodeProjects/Phenotype/repos/cliproxyapi-plusplus".to_string(),
    );
    projects.insert("colab".to_string(), "~/CodeProjects/Phenotype/repos/colab".to_string());
    projects
}

fn default_harness_configs() -> HashMap<String, DefaultHarnessConfig> {
    let mut m = HashMap::new();
    m.insert(
        "claude".into(),
        DefaultHarnessConfig { enabled: true, max_instances: 11, memory_limit_mb: 512 },
    );
    m.insert(
        "forge".into(),
        DefaultHarnessConfig { enabled: true, max_instances: 20, memory_limit_mb: 256 },
    );
    m.insert(
        "node".into(),
        DefaultHarnessConfig { enabled: true, max_instances: 30, memory_limit_mb: 256 },
    );
    m.insert(
        "bun".into(),
        DefaultHarnessConfig { enabled: true, max_instances: 10, memory_limit_mb: 384 },
    );
    m
}

// ---------------------------------------------------------------------------
// Global config singleton
// ---------------------------------------------------------------------------

static GLOBAL_CONFIG: OnceLock<Config> = OnceLock::new();

/// Initialise the global config from the default config file path.
/// Safe to call multiple times — only the first call takes effect.
pub fn init_global() -> &'static Config {
    GLOBAL_CONFIG.get_or_init(|| Config::load().unwrap_or_default())
}

/// Return a reference to the global config (panics if not initialised).
pub fn global() -> &'static Config {
    GLOBAL_CONFIG.get().expect("Config not initialised — call config::init_global() first")
}

// ---------------------------------------------------------------------------
// File-based loading / saving
// ---------------------------------------------------------------------------

impl Config {
    /// Load configuration from `~/.config/sharecli/config.toml`
    pub fn load() -> Result<Self> {
        let config_path = Self::config_path()?;

        if config_path.exists() {
            let contents = std::fs::read_to_string(&config_path)?;
            let config: Config = toml::from_str(&contents)?;
            Ok(config)
        } else {
            Ok(Config::default())
        }
    }

    /// Initialize default configuration file
    pub fn init() -> Result<()> {
        let config_path = Self::config_path()?;

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let config = Config::default();
        let contents = toml::to_string_pretty(&config)?;
        std::fs::write(&config_path, contents)?;

        Ok(())
    }

    /// Save configuration
    pub fn save(&self) -> Result<()> {
        let config_path = Self::config_path()?;

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let contents = toml::to_string_pretty(self)?;
        std::fs::write(&config_path, contents)?;

        Ok(())
    }

    /// Get config file path
    fn config_path() -> Result<PathBuf> {
        let base =
            dirs::config_dir().ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?;
        Ok(base.join("sharecli").join("config.toml"))
    }
}

// ---------------------------------------------------------------------------
// CLI command enums (defined here to avoid circular dependencies)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cast configuration
// ---------------------------------------------------------------------------

/// Settings for the `cast` subcommand (cross-machine text injection into
/// registered terminal panes).
///
/// Add to `~/.config/sharecli/config.toml`:
///
/// ```toml
/// [cast]
/// default_transport = "wezterm"   # or "ghostty" / "clipboard"
/// pane_map_path = "~/.config/sharecli/pane-map.toml"
/// handshake_timeout_ms = 250
/// max_retry_attempts = 3
/// retry_backoff_ms = 200
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CastConfig {
    /// Default transport to use when `cast send` is invoked.
    /// One of: `wezterm`, `ghostty`, `clipboard`.
    pub default_transport: String,
    /// Override the on-disk path for the pane registry. When `None`, defaults
    /// to `<config_dir>/sharecli/pane-map.toml`.
    pub pane_map_path: Option<String>,
    /// Time (ms) to wait for an OSC 9;4 echo confirmation before declaring
    /// the send failed and triggering a retry.
    pub handshake_timeout_ms: u64,
    /// Max retries for transient send failures.
    pub max_retry_attempts: u32,
    /// Initial backoff (ms) between retry attempts (doubles each retry).
    pub retry_backoff_ms: u64,
}

impl Default for CastConfig {
    fn default() -> Self {
        Self {
            default_transport: "wezterm".into(),
            pane_map_path: None,
            handshake_timeout_ms: 250,
            max_retry_attempts: 3,
            retry_backoff_ms: 200,
        }
    }
}

#[derive(clap::Subcommand, Debug)]
pub enum ConfigCmd {
    /// Initialize default configuration
    Init,
    /// Validate configuration
    Validate,
    /// Show current configuration
    Show,
    /// Get a configuration value
    Get { key: String },
    /// Set a configuration value
    Set { key: String, value: String },
}

#[derive(clap::Subcommand, Debug)]
pub enum ProjectCmd {
    /// Add a project to the registry
    Add { name: String, path: String },
    /// Remove a project from the registry
    Remove { name: String },
    /// List all registered projects
    List,
    /// Show project details
    Show { name: String },
    /// Discover projects in a directory
    Discover { path: Option<String> },
    /// Generate process-compose.yml from registered projects
    Generate { output: Option<String> },
}
