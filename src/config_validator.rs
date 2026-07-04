//! Configuration validation for sharecli.
//!
//! After deserializing a [`Config`] from TOML, call [`validate_config`] to
//! collect every constraint violation in a single pass. If the returned
//! [`Vec`] is non-empty the caller should print all errors and exit.

use crate::config::Config;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// A single constraint violation found during config validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError {
    /// Dotted field path, e.g. `config.pool.idle_timeout_secs`.
    pub field: String,
    /// Human-readable description of the constraint that was violated.
    pub message: String,
}

impl ValidationError {
    fn new(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self { field: field.into(), message: message.into() }
    }
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

// ---------------------------------------------------------------------------
// Validation entry-point
// ---------------------------------------------------------------------------

/// Validate every constraint in `config` and return *all* errors found.
///
/// Returns an empty [`Vec`] when the config is valid.
pub fn validate_config(config: &Config) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    validate_pool(&config.pool, &mut errors);
    validate_monitoring(&config.monitoring, &mut errors);
    validate_port(&config.port, &mut errors);
    validate_paths(&config.paths, &mut errors);
    validate_project_limits(&config.project_limits, &mut errors);
    validate_spawn(&config.spawn, &mut errors);
    validate_spawn_policy(&config.spawn_policy, &mut errors);
    validate_cast(&config.cast, &mut errors);
    validate_defaults(&config.defaults, &mut errors);

    errors
}

// ---------------------------------------------------------------------------
// Print + exit helper
// ---------------------------------------------------------------------------

/// Print all validation errors to stderr and exit with code 1.
///
/// Intended to be called from `main` when [`validate_config`] returns a
/// non-empty error list.
pub fn report_and_exit(errors: &[ValidationError]) -> ! {
    eprintln!(
        "Config validation failed ({} error{}):",
        errors.len(),
        if errors.len() == 1 { "" } else { "s" }
    );
    for err in errors {
        eprintln!("  {err}");
    }
    std::process::exit(1);
}

// ---------------------------------------------------------------------------
// Section validators
// ---------------------------------------------------------------------------

fn validate_pool(pool: &crate::config::PoolConfig, errors: &mut Vec<ValidationError>) {
    if pool.max_per_type == 0 {
        errors.push(ValidationError::new("config.pool.max_per_type", "must be greater than 0"));
    }
    if pool.idle_timeout_secs == 0 {
        errors
            .push(ValidationError::new("config.pool.idle_timeout_secs", "must be greater than 0"));
    }
    if pool.idle_timeout_secs > 3600 {
        errors
            .push(ValidationError::new("config.pool.idle_timeout_secs", "must be <= 3600 seconds"));
    }
    if pool.max_age_secs == 0 {
        errors.push(ValidationError::new("config.pool.max_age_secs", "must be greater than 0"));
    }
    if pool.max_age_secs > 86400 {
        errors.push(ValidationError::new(
            "config.pool.max_age_secs",
            "must be <= 86400 seconds (24 h)",
        ));
    }
    if pool.spawn_delay_ms == 0 {
        errors.push(ValidationError::new("config.pool.spawn_delay_ms", "must be greater than 0"));
    }
}

fn validate_monitoring(mon: &crate::config::MonitoringConfig, errors: &mut Vec<ValidationError>) {
    if mon.health_check_interval_secs == 0 {
        errors.push(ValidationError::new(
            "config.monitoring.health_check_interval_secs",
            "must be greater than 0",
        ));
    }
    if mon.health_check_interval_secs > 3600 {
        errors.push(ValidationError::new(
            "config.monitoring.health_check_interval_secs",
            "must be <= 3600 seconds",
        ));
    }
    if mon.idle_threshold_secs == 0 {
        errors.push(ValidationError::new(
            "config.monitoring.idle_threshold_secs",
            "must be greater than 0",
        ));
    }
    if mon.high_memory_threshold_mb == 0 {
        errors.push(ValidationError::new(
            "config.monitoring.high_memory_threshold_mb",
            "must be greater than 0",
        ));
    }
}

fn validate_port(port: &crate::config::PortConfig, errors: &mut Vec<ValidationError>) {
    if port.sharewei_port == 0 {
        errors.push(ValidationError::new("config.port.sharewei_port", "must be greater than 0"));
    }
}

fn validate_paths(paths: &crate::config::PathsConfig, errors: &mut Vec<ValidationError>) {
    if paths.discovery_path.trim().is_empty() {
        errors.push(ValidationError::new("config.paths.discovery_path", "must not be empty"));
    }
    if paths.default_compose_output.trim().is_empty() {
        errors
            .push(ValidationError::new("config.paths.default_compose_output", "must not be empty"));
    }
}

fn validate_project_limits(
    limits: &crate::config::ProjectLimitsConfig,
    errors: &mut Vec<ValidationError>,
) {
    if limits.memory_limit_mb == 0 {
        errors.push(ValidationError::new(
            "config.project_limits.memory_limit_mb",
            "must be greater than 0",
        ));
    }
    if limits.max_processes == 0 {
        errors.push(ValidationError::new(
            "config.project_limits.max_processes",
            "must be greater than 0",
        ));
    }
}

fn validate_spawn(spawn: &crate::config::SpawnConfig, errors: &mut Vec<ValidationError>) {
    if spawn.default_harness.trim().is_empty() {
        errors.push(ValidationError::new("config.spawn.default_harness", "must not be empty"));
    }
    if spawn.prune_idle_seconds == 0 {
        errors.push(ValidationError::new(
            "config.spawn.prune_idle_seconds",
            "must be greater than 0",
        ));
    }
}

fn validate_spawn_policy(
    policy: &crate::config::SpawnPolicyConfig,
    errors: &mut Vec<ValidationError>,
) {
    if policy.max_concurrent_builds == 0 {
        errors.push(ValidationError::new(
            "config.spawn_policy.max_concurrent_builds",
            "must be greater than 0",
        ));
    }
}

fn validate_cast(cast: &crate::config::CastConfig, errors: &mut Vec<ValidationError>) {
    if cast.default_transport.trim().is_empty() {
        errors.push(ValidationError::new("config.cast.default_transport", "must not be empty"));
    }
    if cast.handshake_timeout_ms == 0 {
        errors.push(ValidationError::new(
            "config.cast.handshake_timeout_ms",
            "must be greater than 0",
        ));
    }
    if cast.retry_backoff_ms == 0 {
        errors.push(ValidationError::new("config.cast.retry_backoff_ms", "must be greater than 0"));
    }
}

fn validate_defaults(
    defaults: &std::collections::HashMap<String, crate::config::DefaultHarnessConfig>,
    errors: &mut Vec<ValidationError>,
) {
    for (name, cfg) in defaults {
        if cfg.max_instances == 0 {
            errors.push(ValidationError::new(
                format!("config.defaults.{name}.max_instances"),
                "must be greater than 0",
            ));
        }
        if cfg.memory_limit_mb == 0 {
            errors.push(ValidationError::new(
                format!("config.defaults.{name}.memory_limit_mb"),
                "must be greater than 0",
            ));
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{
        CastConfig, Config, DefaultHarnessConfig, MonitoringConfig, PathsConfig, PoolConfig,
        PortConfig, ProjectLimitsConfig, SpawnConfig, SpawnPolicyConfig,
    };

    fn valid_config() -> Config {
        Config::default()
    }

    // 1. Default config is fully valid.
    #[test]
    fn test_default_config_is_valid() {
        let cfg = valid_config();
        let errs = validate_config(&cfg);
        assert!(errs.is_empty(), "unexpected errors: {errs:#?}");
    }

    // 2. Zero pool.max_per_type fails.
    #[test]
    fn test_pool_max_per_type_zero_fails() {
        let mut cfg = valid_config();
        cfg.pool.max_per_type = 0;
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.pool.max_per_type"));
    }

    // 3. Zero port fails.
    #[test]
    fn test_port_zero_fails() {
        let mut cfg = valid_config();
        cfg.port = PortConfig { sharewei_port: 0 };
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.port.sharewei_port"));
    }

    // 4. Empty discovery_path fails.
    #[test]
    fn test_empty_discovery_path_fails() {
        let mut cfg = valid_config();
        cfg.paths.discovery_path = "  ".into();
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.paths.discovery_path"));
    }

    // 5. Multiple simultaneous errors are all collected.
    #[test]
    fn test_multiple_errors_collected() {
        let mut cfg = valid_config();
        cfg.pool.max_per_type = 0;
        cfg.port = PortConfig { sharewei_port: 0 };
        cfg.paths.discovery_path = String::new();
        cfg.spawn.default_harness = String::new();
        let errs = validate_config(&cfg);
        assert!(errs.len() >= 4, "expected >=4 errors, got {}", errs.len());
    }

    // 6. Zero monitoring.health_check_interval_secs fails.
    #[test]
    fn test_zero_health_check_interval_fails() {
        let mut cfg = valid_config();
        cfg.monitoring.health_check_interval_secs = 0;
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.monitoring.health_check_interval_secs"));
    }

    // 7. Zero spawn.prune_idle_seconds (zero timeout) fails.
    #[test]
    fn test_zero_prune_idle_seconds_fails() {
        let mut cfg = valid_config();
        cfg.spawn.prune_idle_seconds = 0;
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.spawn.prune_idle_seconds"));
    }

    // 8. health_check_interval_secs > 3600 fails.
    #[test]
    fn test_health_check_interval_too_large_fails() {
        let mut cfg = valid_config();
        cfg.monitoring.health_check_interval_secs = 3601;
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.monitoring.health_check_interval_secs"));
    }

    // 9. Zero project_limits.max_processes fails.
    #[test]
    fn test_zero_project_max_processes_fails() {
        let mut cfg = valid_config();
        cfg.project_limits.max_processes = 0;
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.project_limits.max_processes"));
    }

    // 10. Zero spawn_policy.max_concurrent_builds fails.
    #[test]
    fn test_zero_max_concurrent_builds_fails() {
        let mut cfg = valid_config();
        cfg.spawn_policy.max_concurrent_builds = 0;
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.spawn_policy.max_concurrent_builds"));
    }

    // 11. Zero harness max_instances in defaults fails.
    #[test]
    fn test_defaults_zero_max_instances_fails() {
        let mut cfg = valid_config();
        cfg.defaults.insert(
            "testharness".into(),
            DefaultHarnessConfig { enabled: true, max_instances: 0, memory_limit_mb: 256 },
        );
        let errs = validate_config(&cfg);
        assert!(errs.iter().any(|e| e.field == "config.defaults.testharness.max_instances"));
    }
}
