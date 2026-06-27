//! Fleet-level summary aggregation across multiple `GateVerdict`s.
//!
//! Authority: ADR-040 + v19 71-pillar cycle 9 plan §2 Track T4.

use crate::gate::{GateVerdict, RegressionLevel};

/// Aggregate multiple verdicts into a single human-readable summary line.
///
/// Output shape (stable across nightly + PR runs so PR-comment diffs are
/// readable):
///
/// ```text
/// {n} budgets: {passed} passed, {failed} failed
/// ```
///
/// If exactly one verdict failed, the summary appends a parenthetical naming
/// the first failing budget so reviewers can scan PR comments quickly.
pub fn fleet_summary(verdicts: &[GateVerdict]) -> String {
    let total = verdicts.len();
    let passed = verdicts.iter().filter(|v| v.passed).count();
    let failed = total - passed;

    let mut out = format!("{total} budgets: {passed} passed, {failed} failed");

    if failed == 1 {
        if let Some(v) = verdicts.iter().find(|v| !v.passed) {
            if let Some(r) = v
                .regressions
                .iter()
                .find(|r| matches!(r.level, RegressionLevel::Hard))
                .or_else(|| v.regressions.first())
            {
                out.push_str(&format!(" (L19 regression in {})", r.budget_name));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gate::Regression;

    fn v(passed: bool, name: &str) -> GateVerdict {
        GateVerdict {
            passed,
            summary: "s".into(),
            regressions: if passed {
                Vec::new()
            } else {
                vec![Regression {
                    budget_name: name.into(),
                    actual_ms: 100.0,
                    budget_ms: 50.0,
                    level: RegressionLevel::Hard,
                }]
            },
        }
    }

    #[test]
    fn test_fleet_summary_aggregates_correctly() {
        let verdicts = vec![v(true, "x"), v(true, "y"), v(false, "pheno-config.parse_cargo")];
        let s = fleet_summary(&verdicts);
        assert_eq!(s, "3 budgets: 2 passed, 1 failed (L19 regression in pheno-config.parse_cargo)");
    }

    #[test]
    fn test_fleet_summary_all_pass() {
        let verdicts = vec![v(true, "x"), v(true, "y")];
        let s = fleet_summary(&verdicts);
        assert_eq!(s, "2 budgets: 2 passed, 0 failed");
    }

    #[test]
    fn test_fleet_summary_empty() {
        let s = fleet_summary(&[]);
        assert_eq!(s, "0 budgets: 0 passed, 0 failed");
    }
}
