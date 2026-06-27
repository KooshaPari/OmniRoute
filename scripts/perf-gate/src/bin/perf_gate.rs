//! `perf_gate` binary — CLI entry point for the fleet performance gate.
//!
//! Loads `benchmarks/fleet-perf.toml`, evaluates measured samples against each
//! declared budget, prints a verdict in the requested format, and exits with
//! a code reflecting the outcome.
//!
//! Exit codes:
//! - 0 — all budgets within ceiling (or only soft regressions when not
//!       configured to fail on soft).
//! - 1 — at least one hard regression.
//! - 2 — soft regression present and `fail_on_soft_regression` is set.
//!
//! Authority: ADR-040 + v19 71-pillar cycle 9 plan §2 Track T4.

use clap::Parser;
use perf_gate::config::{GateConfig, OutputFormat};
use perf_gate::gate::{Gate, GateVerdict, Regression, RegressionLevel};
use perf_gate::report::{JsonReporter, MarkdownReporter, Reporter, TextReporter};
use perf_gate::summary::fleet_summary;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;

#[derive(Parser, Debug)]
#[command(
    name = "perf_gate",
    version,
    about = "Fleet performance gate — evaluates fleet-perf.toml budgets"
)]
struct Cli {
    /// Path to the `fleet-perf.toml` manifest (overrides PERF_GATE_BUDGETS).
    #[arg(long)]
    budgets: Option<PathBuf>,
    /// Treat soft-budget regressions as failures.
    #[arg(long)]
    fail_on_soft_regression: bool,
    /// Output format: text (default), json, markdown.
    #[arg(long, default_value = "text")]
    format: String,
    /// Skip actually running commands — measure zero samples (smoke test).
    #[arg(long)]
    stub: bool,
}

fn main() {
    let cli = Cli::parse();
    // Build config: CLI flag > env var > default. from_env() does not
    // validate the path; the explicit `validate()` call (or Gate::new's
    // implicit budget read) surfaces a MissingBudgets error.
    let mut config = match GateConfig::from_env() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("config error: {e}");
            std::process::exit(2);
        }
    };
    if let Some(p) = cli.budgets {
        config.perf_budgets_path = p;
    }
    if cli.fail_on_soft_regression {
        config.fail_on_soft_regression = true;
    }
    config.output_format = match cli.format.to_ascii_lowercase().as_str() {
        "text" => OutputFormat::Text,
        "json" => OutputFormat::Json,
        "markdown" | "md" => OutputFormat::Markdown,
        other => {
            eprintln!("invalid --format value: {other}");
            std::process::exit(2);
        }
    };

    if let Err(e) = config.validate() {
        eprintln!("config error: {e}");
        std::process::exit(2);
    }

    let gate = match Gate::new(config.clone()) {
        Ok(g) => g,
        Err(e) => {
            eprintln!("gate load error: {e}");
            std::process::exit(2);
        }
    };

    let verdicts = if cli.stub {
        gate.budgets
            .iter()
            .map(|b| GateVerdict {
                passed: true,
                regressions: Vec::new(),
                summary: format!("stub: skipped {}", b.name),
            })
            .collect::<Vec<_>>()
    } else {
        gate.budgets
            .iter()
            .map(|budget| evaluate_one(budget))
            .collect()
    };

    let reporter: Box<dyn Reporter> = match config.output_format {
        OutputFormat::Text => Box::new(TextReporter),
        OutputFormat::Json => Box::new(JsonReporter),
        OutputFormat::Markdown => Box::new(MarkdownReporter),
    };

    for v in &verdicts {
        print!("{}", reporter.render(v));
    }

    println!("---\nFleet summary: {}", fleet_summary(&verdicts));

    let any_hard = verdicts
        .iter()
        .flat_map(|v| v.regressions.iter())
        .any(|r| matches!(r.level, RegressionLevel::Hard));
    let any_soft = verdicts
        .iter()
        .flat_map(|v| v.regressions.iter())
        .any(|r| matches!(r.level, RegressionLevel::Soft));

    let exit_code = if any_hard {
        1
    } else if any_soft && config.fail_on_soft_regression {
        2
    } else {
        0
    };
    std::process::exit(exit_code);
}

fn evaluate_one(budget: &perf_gate::budgets::PerformanceBudget) -> GateVerdict {
    let mut samples = Vec::with_capacity(budget.runs as usize);
    for _ in 0..budget.runs {
        let t0 = Instant::now();
        // The fleet-perf.toml uses `command = "true"` as a no-op stub. Real
        // benchmarks will replace `command` with the crate's bench binary.
        let _ = Command::new(&budget.command)
            .args(&budget.args)
            .output();
        let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
        samples.push(elapsed_ms);
    }
    let p95 = p95_of(&samples);

    let mut regressions = Vec::new();
    if matches!(
        budget.classify(p95),
        perf_gate::budgets::BudgetClassification::Fail
    ) {
        let level = match budget.kind {
            perf_gate::budgets::BudgetKind::Hard => RegressionLevel::Hard,
            perf_gate::budgets::BudgetKind::Soft => RegressionLevel::Soft,
        };
        regressions.push(Regression {
            budget_name: budget.name.clone(),
            actual_ms: p95,
            budget_ms: budget.p95_budget_ms as f64,
            level,
        });
    }

    let passed = regressions.is_empty();
    let summary = if passed {
        format!("{}: p95={:.3} ms within {} ms", budget.name, p95, budget.p95_budget_ms)
    } else {
        format!("{}: p95={:.3} ms EXCEEDS {} ms", budget.name, p95, budget.p95_budget_ms)
    };
    GateVerdict {
        passed,
        regressions,
        summary,
    }
}

fn p95_of(samples: &[f64]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    let mut sorted: Vec<f64> = samples.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let idx = ((sorted.len() as f64 - 1.0) * 0.95).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

// ---------- integration tests (run via `cargo test`) ----------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn integration_test_runs_against_temp_manifest_and_passes() {
        // Build a temp manifest with a generous budget and the no-op `true`
        // command so the gate must pass end-to-end.
        let mut f = tempfile::NamedTempFile::new().expect("tmpfile");
        writeln!(
            f,
            r#"
[defaults]
runs = 3
command = "true"

[pheno-config.parse_cargo]
p95_budget_ms = 1000
runs = 3
command = "true"
args = []
description = "integration test"
"#
        )
        .unwrap();
        let path = f.path().to_path_buf();

        let cfg = GateConfig {
            perf_budgets_path: path,
            fail_on_soft_regression: false,
            output_format: OutputFormat::Text,
        };
        let gate = Gate::new(cfg).expect("gate loads");
        assert_eq!(gate.budgets.len(), 1);
        assert_eq!(gate.budgets[0].name, "pheno-config.parse_cargo");

        let verdict = evaluate_one(&gate.budgets[0]);
        assert!(verdict.passed, "expected pass, got {:?}", verdict);
        assert!(verdict.regressions.is_empty());
    }

    #[test]
    fn integration_test_fails_on_impossibly_low_budget() {
        // p95_budget_ms = 0 forces a fail.
        let mut f = tempfile::NamedTempFile::new().expect("tmpfile");
        writeln!(
            f,
            r#"
[defaults]
runs = 2
command = "true"

[pheno-x.too_tight]
p95_budget_ms = 0
runs = 2
command = "true"
args = []
description = "should always fail"
"#
        )
        .unwrap();
        let path = f.path().to_path_buf();

        let cfg = GateConfig {
            perf_budgets_path: path,
            fail_on_soft_regression: false,
            output_format: OutputFormat::Json,
        };
        let gate = Gate::new(cfg).expect("gate loads");
        let verdict = evaluate_one(&gate.budgets[0]);
        assert!(!verdict.passed);
        assert_eq!(verdict.regressions.len(), 1);
        assert_eq!(verdict.regressions[0].level, RegressionLevel::Hard);
    }
}
