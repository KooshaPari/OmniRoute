//! Gate configuration — env + CLI overrides for the perf gate runner.
//!
//! Authority: ADR-040 + v19 71-pillar cycle 9 plan §2 Track T4.

use std::path::PathBuf;
use thiserror::Error;

/// Output format requested by the caller (or default `Text`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum OutputFormat {
    /// Plain-text human report.
    #[default]
    Text,
    /// Machine-readable JSON.
    Json,
    /// Markdown table.
    Markdown,
}

/// Resolved configuration for a single `perf_gate` invocation.
#[derive(Debug, Clone)]
pub struct GateConfig {
    /// Path to the `fleet-perf.toml` manifest.
    pub perf_budgets_path: PathBuf,
    /// When true, soft-budget regressions fail the gate (exit 2). When false,
    /// soft regressions are reported only (exit 0 if no hard regressions).
    pub fail_on_soft_regression: bool,
    /// How to format the verdict in stdout.
    pub output_format: OutputFormat,
}

/// Errors raised while building `GateConfig`.
#[derive(Debug, Error)]
pub enum ConfigError {
    /// `PERF_GATE_BUDGETS` pointed at a path that does not exist.
    #[error("budget manifest not found at {0}")]
    MissingBudgets(PathBuf),
    /// Caller requested an unknown `--format` value.
    #[error("invalid output format: {0}")]
    InvalidFormat(String),
    /// I/O error while resolving the path.
    #[error("I/O error resolving config: {0}")]
    Io(#[from] std::io::Error),
}

impl GateConfig {
    /// Build a config from process environment variables.
    ///
    /// Honors:
    /// - `PERF_GATE_BUDGETS` — defaults to `benchmarks/fleet-perf.toml`.
    /// - `PERF_GATE_FAIL_ON_SOFT` — `1` / `true` enables soft-regression failure.
    /// - `PERF_GATE_FORMAT` — `text` / `json` / `markdown` (case-insensitive).
    ///
    /// This function does NOT validate that the budgets path exists; that
    /// check happens in `Gate::new` via `load_budgets_from_path`. Callers that
    /// want to surface a `MissingBudgets` error early should call
    /// [`GateConfig::validate`] explicitly.
    pub fn from_env() -> Result<Self, ConfigError> {
        let pathbuf = PathBuf::from(
            std::env::var("PERF_GATE_BUDGETS")
                .unwrap_or_else(|_| "benchmarks/fleet-perf.toml".to_string()),
        );
        let fail_on_soft_regression = matches!(
            std::env::var("PERF_GATE_FAIL_ON_SOFT").as_deref(),
            Ok("1") | Ok("true") | Ok("TRUE") | Ok("yes")
        );
        let output_format = match std::env::var("PERF_GATE_FORMAT")
            .as_deref()
            .unwrap_or("text")
            .to_ascii_lowercase()
            .as_str()
        {
            "text" => OutputFormat::Text,
            "json" => OutputFormat::Json,
            "markdown" | "md" => OutputFormat::Markdown,
            other => return Err(ConfigError::InvalidFormat(other.to_string())),
        };
        Ok(GateConfig {
            perf_budgets_path: pathbuf,
            fail_on_soft_regression,
            output_format,
        })
    }

    /// Validate that the configured budgets path exists on disk.
    pub fn validate(&self) -> Result<(), ConfigError> {
        if !self.perf_budgets_path.exists() {
            return Err(ConfigError::MissingBudgets(self.perf_budgets_path.clone()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_succeeds() {
        // from_env must build a valid config when PERF_GATE_BUDGETS points at
        // a path that exists. from_env itself does not validate path existence
        // (see GateConfig::validate for that); the test asserts the path is
        // set to the env value.
        let mut f = tempfile::NamedTempFile::new().expect("tmpfile");
        std::io::Write::write_all(&mut f, b"[meta]\nversion = \"t\"\n").expect("write");
        let path = f.path().to_path_buf();

        let prev = std::env::var("PERF_GATE_BUDGETS").ok();
        std::env::set_var("PERF_GATE_BUDGETS", &path);
        let cfg = GateConfig::from_env().expect("from_env must build config without validating");
        assert_eq!(cfg.perf_budgets_path, path);
        assert_eq!(cfg.output_format, OutputFormat::Text);
        // validate() must succeed for an existing path.
        cfg.validate().expect("validate must succeed for existing path");

        // Default (unset) resolution.
        std::env::remove_var("PERF_GATE_BUDGETS");
        let cfg_default = GateConfig::from_env().expect("default resolution");
        assert_eq!(
            cfg_default.perf_budgets_path,
            PathBuf::from("benchmarks/fleet-perf.toml")
        );

        if let Some(v) = prev {
            std::env::set_var("PERF_GATE_BUDGETS", v);
        }
        // `f` is dropped at end of test → temp file deleted.
    }
}
