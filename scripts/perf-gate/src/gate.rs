//! Gate — loads budgets and evaluates sample sets against them.
//!
//! Authority: ADR-040 + v19 71-pillar cycle 9 plan §2 Track T4.

use crate::budgets::{load_budgets_from_path, BudgetError, PerformanceBudget};
use crate::config::GateConfig;
use thiserror::Error;

/// Severity of a single regression.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegressionLevel {
    /// Hard budget violated — exit 1.
    Hard,
    /// Soft budget violated — exit 2 only if `fail_on_soft_regression`.
    Soft,
}

/// One recorded regression.
#[derive(Debug, Clone, PartialEq)]
pub struct Regression {
    /// Budget name (e.g. `pheno-config.parse_cargo`).
    pub budget_name: String,
    /// Observed p95 in ms.
    pub actual_ms: f64,
    /// Budgeted p95 ceiling in ms.
    pub budget_ms: f64,
    /// Hard or soft.
    pub level: RegressionLevel,
}

/// The verdict of evaluating a sample set against the loaded budgets.
#[derive(Debug, Clone, PartialEq)]
pub struct GateVerdict {
    /// True iff no Hard regression AND (no Soft regression OR `fail_on_soft_regression` is false).
    pub passed: bool,
    /// All regressions (Hard + Soft), empty on pass.
    pub regressions: Vec<Regression>,
    /// Human-readable summary line.
    pub summary: String,
}

/// Errors raised by the gate.
#[derive(Debug, Error)]
pub enum GateError {
    /// Budget manifest could not be loaded.
    #[error("failed to load budgets: {0}")]
    Budgets(#[from] BudgetError),
}

/// The gate — bundles config + parsed budgets + evaluation logic.
pub struct Gate {
    /// Resolved configuration.
    #[allow(dead_code)]
    pub config: GateConfig,
    /// Parsed budgets from the manifest.
    pub budgets: Vec<PerformanceBudget>,
}

impl Gate {
    /// Build a gate by reading the manifest at `config.perf_budgets_path`.
    pub fn new(config: GateConfig) -> Result<Self, GateError> {
        let budgets = load_budgets_from_path(&config.perf_budgets_path)?;
        Ok(Self { config, budgets })
    }

    /// Evaluate `samples` (interpreted as p95/p99 sample list in milliseconds)
    /// against the *first* loaded budget. Returns a verdict describing the
    /// pass/fail outcome and any regressions.
    ///
    /// When multiple budgets are loaded, callers should iterate and aggregate
    /// via `summary::fleet_summary`.
    pub fn evaluate(&self, samples: &[f64]) -> GateVerdict {
        let mut regressions = Vec::new();
        let p95 = p95_of(samples);
        for budget in &self.budgets {
            if matches!(
                budget.classify(p95),
                crate::budgets::BudgetClassification::Fail
            ) {
                let level = match budget.kind {
                    crate::budgets::BudgetKind::Hard => RegressionLevel::Hard,
                    crate::budgets::BudgetKind::Soft => RegressionLevel::Soft,
                };
                regressions.push(Regression {
                    budget_name: budget.name.clone(),
                    actual_ms: p95,
                    budget_ms: budget.p95_budget_ms as f64,
                    level,
                });
            }
        }
        let hard_fail = regressions
            .iter()
            .any(|r| matches!(r.level, RegressionLevel::Hard));
        let soft_fail = regressions
            .iter()
            .any(|r| matches!(r.level, RegressionLevel::Soft));
        let passed = !hard_fail && (!soft_fail || !self.config.fail_on_soft_regression);
        let summary = if regressions.is_empty() {
            format!("all {} budgets within budget", self.budgets.len())
        } else {
            format!(
                "{} regressions across {} budgets",
                regressions.len(),
                self.budgets.len()
            )
        };
        GateVerdict {
            passed,
            regressions,
            summary,
        }
    }
}

/// Compute the p95 of a sample set. For empty input returns 0.0.
fn p95_of(samples: &[f64]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    let mut sorted: Vec<f64> = samples.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let idx = ((sorted.len() as f64 - 1.0) * 0.95).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::budgets::BudgetKind;
    use crate::config::OutputFormat;
    use std::io::Write;

    fn cfg_with(path: std::path::PathBuf) -> GateConfig {
        GateConfig {
            perf_budgets_path: path,
            fail_on_soft_regression: false,
            output_format: OutputFormat::Text,
        }
    }

    fn write_tmp_manifest(body: &str) -> (tempfile::NamedTempFile, std::path::PathBuf) {
        let mut f = tempfile::NamedTempFile::new().expect("tmpfile");
        f.write_all(body.as_bytes()).expect("write");
        let path = f.path().to_path_buf();
        (f, path)
    }

    const MANIFEST_ONE_BUDGET: &str = r#"
[meta]
version = "test"

[defaults]
runs = 10
command = "true"

[pheno-config.parse_cargo]
p95_budget_ms = 50
runs = 5
command = "true"
args = ["parse_cargo"]
description = "test"
"#;

    #[test]
    fn test_evaluate_pass_within_budget() {
        let (_f, path) = write_tmp_manifest(MANIFEST_ONE_BUDGET);
        let gate = Gate::new(cfg_with(path)).expect("gate loads");
        // p95 of [1..10] ms is ≤ budget 50.
        let verdict = gate.evaluate(&(1..=10).map(|x| x as f64).collect::<Vec<_>>());
        assert!(verdict.passed, "expected pass, got {:?}", verdict);
        assert!(verdict.regressions.is_empty());
        assert!(verdict.summary.contains("within budget"));
    }

    #[test]
    fn test_evaluate_fail_over_budget() {
        let (_f, path) = write_tmp_manifest(MANIFEST_ONE_BUDGET);
        let gate = Gate::new(cfg_with(path)).expect("gate loads");
        // All samples 100 ms → p95 = 100 > budget 50.
        let verdict = gate.evaluate(&vec![100.0; 10]);
        assert!(!verdict.passed, "expected fail, got {:?}", verdict);
        assert_eq!(verdict.regressions.len(), 1);
        assert_eq!(
            verdict.regressions[0].budget_name,
            "pheno-config.parse_cargo"
        );
        assert_eq!(verdict.regressions[0].level, RegressionLevel::Hard);
        assert!((verdict.regressions[0].budget_ms - 50.0).abs() < 1e-9);
    }

    #[test]
    fn test_soft_regression_does_not_fail_when_not_required() {
        // Soft budget violation should NOT fail when fail_on_soft_regression is false.
        let (_f, path) = write_tmp_manifest(
            r#"
[defaults]
runs = 5
command = "true"

[pheno-x.soft_method]
p95_budget_ms = 1
runs = 5
command = "true"
"#,
        );
        let cfg = GateConfig {
            perf_budgets_path: path,
            fail_on_soft_regression: false,
            output_format: OutputFormat::Text,
        };
        // Override the loaded budget to be Soft.
        let mut gate = Gate::new(cfg).expect("gate loads");
        gate.budgets[0].kind = BudgetKind::Soft;
        let verdict = gate.evaluate(&vec![10.0; 5]);
        assert!(verdict.passed, "soft-only should pass when not required");
        assert_eq!(verdict.regressions.len(), 1);
        assert_eq!(verdict.regressions[0].level, RegressionLevel::Soft);
    }
}
