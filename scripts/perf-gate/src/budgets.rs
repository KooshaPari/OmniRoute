//! Budget type + classification — fleet-perf.toml → in-memory representation.
//!
//! Authority: ADR-040 + v19 71-pillar cycle 9 plan §2 Track T4.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;
use thiserror::Error;

/// Classification of a single measurement against its budget.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BudgetKind {
    /// Hard budget: a violation fails the gate (exit 1).
    Hard,
    /// Soft budget: a violation is reported but does not fail the gate
    /// (exit 2 only when `fail_on_soft_regression` is set).
    Soft,
}

/// One declared budget, parsed from `fleet-perf.toml`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PerformanceBudget {
    /// Fully-qualified name, e.g. `pheno-config.parse_cargo`.
    pub name: String,
    /// p95 ceiling in milliseconds.
    pub p95_budget_ms: u64,
    /// Sample count for p95 computation.
    pub runs: u32,
    /// Hard or soft.
    pub kind: BudgetKind,
    /// Binary to invoke; defaults to `true` (no-op).
    pub command: String,
    /// Args passed to the command.
    pub args: Vec<String>,
    /// Human-readable summary.
    pub description: String,
}

/// Outcome of evaluating one sample set against one budget.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BudgetClassification {
    /// p95 observed ≤ budget.
    Pass,
    /// p95 observed > budget; carries the overrun ratio for the regression record.
    Fail,
}

/// Errors raised while parsing `fleet-perf.toml`.
#[derive(Debug, Error)]
pub enum BudgetError {
    /// File not found or unreadable.
    #[error("I/O error reading budget file: {0}")]
    Io(#[from] std::io::Error),
    /// TOML parse error.
    #[error("TOML parse error: {0}")]
    Toml(#[from] toml::de::Error),
}

/// Raw shape of `benchmarks/fleet-perf.toml` (matches the v19 T4 schema).
#[derive(Debug, Deserialize)]
pub(crate) struct RawManifest {
    #[serde(default)]
    pub(crate) defaults: RawDefaults,
    #[serde(flatten)]
    pub(crate) groups: BTreeMap<String, toml::Value>,
}

/// `[defaults]` section.
#[derive(Debug, Deserialize, Default)]
pub(crate) struct RawDefaults {
    pub(crate) runs: Option<u32>,
    pub(crate) command: Option<String>,
}

impl PerformanceBudget {
    /// Classify an observed p95 against this budget's ceiling.
    pub fn classify(&self, p95_observed_ms: f64) -> BudgetClassification {
        if p95_observed_ms <= self.p95_budget_ms as f64 {
            BudgetClassification::Pass
        } else {
            BudgetClassification::Fail
        }
    }
}

/// Parse `fleet-perf.toml` into a flat list of `PerformanceBudget`.
///
/// The TOML shape is nested by crate (`[pheno-config.parse_cargo]`) and the
/// "soft" classification is currently uniform (all budgets are Hard; this is
/// the v19 T4 starting position and the `[meta].schema_doc` field cross-
/// references ADR-026 + the 71-pillar schema for future extension).
pub fn load_budgets_from_path(path: &Path) -> Result<Vec<PerformanceBudget>, BudgetError> {
    let raw = std::fs::read_to_string(path)?;
    let manifest: RawManifest = toml::from_str(&raw)?;
    let default_runs = manifest.defaults.runs.unwrap_or(10);
    let default_command = manifest.defaults.command.unwrap_or_else(|| "true".to_string());

    let mut out = Vec::new();
    for (group, value) in &manifest.groups {
        if group == "meta" || group == "defaults" {
            continue;
        }
        // Each group may be either a flat budget table OR a nested table of
        // {method → budget}. Match both shapes; mirror perf_gate.py.
        if value.get("p95_budget_ms").is_some() {
            if let Some(budget) = parse_one(group.clone(), value, default_runs, &default_command) {
                out.push(budget);
            }
        } else if let Some(table) = value.as_table() {
            for (method, spec) in table {
                if let Some(budget) = parse_one(
                    format!("{group}.{method}"),
                    spec,
                    default_runs,
                    &default_command,
                ) {
                    out.push(budget);
                }
            }
        }
    }
    Ok(out)
}

fn parse_one(
    name: String,
    spec: &toml::Value,
    default_runs: u32,
    default_command: &str,
) -> Option<PerformanceBudget> {
    let table = spec.as_table()?;
    let p95_budget_ms = table.get("p95_budget_ms")?.as_integer()? as u64;
    let runs = table
        .get("runs")
        .and_then(|v| v.as_integer())
        .map(|v| v as u32)
        .unwrap_or(default_runs);
    let command = table
        .get("command")
        .and_then(|v| v.as_str())
        .unwrap_or(default_command)
        .to_string();
    let args = table
        .get("args")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    let description = table
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    // v19 T4 starting position: every declared budget is Hard. Soft budgets
    // are a future extension — gated on the schema bump in benchmarks/fleet-perf.toml.
    let kind = BudgetKind::Hard;
    Some(PerformanceBudget {
        name,
        p95_budget_ms,
        runs,
        kind,
        command,
        args,
        description,
    })
}
