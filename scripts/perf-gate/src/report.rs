//! Reporter — format a `GateVerdict` for human or machine readers.
//!
//! Authority: ADR-040 + v19 71-pillar cycle 9 plan §2 Track T4.

use crate::gate::{GateVerdict, RegressionLevel};

/// A reporter renders a `GateVerdict` to a string.
pub trait Reporter {
    /// Render the verdict. Implementations must be deterministic so the
    /// nightly + PR runs produce stable diffs in `findings/`.
    fn render(&self, verdict: &GateVerdict) -> String;
}

/// Plain-text reporter — default for human reading in CI logs.
pub struct TextReporter;

impl Reporter for TextReporter {
    fn render(&self, verdict: &GateVerdict) -> String {
        let mut out = String::new();
        out.push_str(if verdict.passed {
            "PASS: "
        } else {
            "FAIL: "
        });
        out.push_str(&verdict.summary);
        out.push('\n');
        if !verdict.regressions.is_empty() {
            out.push_str("regressions:\n");
            for r in &verdict.regressions {
                let level = match r.level {
                    RegressionLevel::Hard => "HARD",
                    RegressionLevel::Soft => "SOFT",
                };
                out.push_str(&format!(
                    "  - [{level}] {name}: {actual:.3} ms > {budget:.3} ms\n",
                    level = level,
                    name = r.budget_name,
                    actual = r.actual_ms,
                    budget = r.budget_ms,
                ));
            }
        }
        out
    }
}

/// JSON reporter — for downstream tools and artifact upload.
pub struct JsonReporter;

impl Reporter for JsonReporter {
    fn render(&self, verdict: &GateVerdict) -> String {
        // Hand-rolled JSON to avoid pulling in a JSON crate; the verdict shape
        // is small and stable.
        let mut s = String::from("{\n");
        s.push_str(&format!("  \"passed\": {},\n", verdict.passed));
        s.push_str(&format!(
            "  \"summary\": {},\n",
            json_string(&verdict.summary)
        ));
        s.push_str("  \"regressions\": [");
        if verdict.regressions.is_empty() {
            s.push(']');
        } else {
            s.push('\n');
            for (i, r) in verdict.regressions.iter().enumerate() {
                let comma = if i + 1 < verdict.regressions.len() { "," } else { "" };
                let level = match r.level {
                    RegressionLevel::Hard => "hard",
                    RegressionLevel::Soft => "soft",
                };
                s.push_str(&format!(
                    "    {{\"budget\": {}, \"actual_ms\": {:.3}, \"budget_ms\": {:.3}, \"level\": \"{}\"}}{}\n",
                    json_string(&r.budget_name),
                    r.actual_ms,
                    r.budget_ms,
                    level,
                    comma
                ));
            }
            s.push_str("  ]");
        }
        s.push_str("\n}\n");
        s
    }
}

/// Markdown reporter — for the GitHub Actions PR comment and findings/.
pub struct MarkdownReporter;

impl Reporter for MarkdownReporter {
    fn render(&self, verdict: &GateVerdict) -> String {
        let mut out = String::new();
        out.push_str("## Perf gate verdict\n\n");
        let icon = if verdict.passed { "✅" } else { "❌" };
        out.push_str(&format!(
            "{} **{}** — {}\n\n",
            icon,
            if verdict.passed { "PASS" } else { "FAIL" },
            verdict.summary
        ));
        if !verdict.regressions.is_empty() {
            out.push_str("| budget | actual (ms) | budget (ms) | level |\n");
            out.push_str("|---|---:|---:|---|\n");
            for r in &verdict.regressions {
                let level = match r.level {
                    RegressionLevel::Hard => "HARD",
                    RegressionLevel::Soft => "SOFT",
                };
                out.push_str(&format!(
                    "| {} | {:.3} | {:.3} | {} |\n",
                    r.budget_name, r.actual_ms, r.budget_ms, level
                ));
            }
        }
        out.push('\n');
        out
    }
}

fn json_string(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gate::{Regression, RegressionLevel};

    fn sample_verdict() -> GateVerdict {
        GateVerdict {
            passed: false,
            summary: "1 regressions across 1 budgets".into(),
            regressions: vec![Regression {
                budget_name: "pheno-config.parse_cargo".into(),
                actual_ms: 75.0,
                budget_ms: 50.0,
                level: RegressionLevel::Hard,
            }],
        }
    }

    #[test]
    fn test_text_reporter_includes_budget_name() {
        let r = TextReporter.render(&sample_verdict());
        assert!(r.contains("pheno-config.parse_cargo"), "got: {r}");
        assert!(r.starts_with("FAIL: "));
        assert!(r.contains("[HARD]"));
    }

    #[test]
    fn test_json_reporter_is_well_formed() {
        let r = JsonReporter.render(&sample_verdict());
        assert!(r.contains("\"passed\": false"));
        assert!(r.contains("\"budget\": \"pheno-config.parse_cargo\""));
        assert!(r.contains("\"level\": \"hard\""));
    }

    #[test]
    fn test_markdown_reporter_renders_table() {
        let r = MarkdownReporter.render(&sample_verdict());
        assert!(r.contains("## Perf gate verdict"));
        assert!(r.contains("| budget | actual (ms) | budget (ms) | level |"));
        assert!(r.contains("pheno-config.parse_cargo"));
    }
}
