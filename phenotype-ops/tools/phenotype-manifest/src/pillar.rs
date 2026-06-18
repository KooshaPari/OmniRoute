//! Pillar definitions and check execution

use crate::manifest::{CheckResult, PillarResult};
use anyhow::{anyhow, Context, Result};
use std::collections::HashMap;
use std::process::Command;
use std::time::Instant;
use tracing::{debug, info};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Pillar {
    Quality,
    Security,
    Perf,
    Compliance,
    Docs,
}

impl std::str::FromStr for Pillar {
    type Err = anyhow::Error;
    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "quality" => Ok(Pillar::Quality),
            "security" => Ok(Pillar::Security),
            "perf" | "performance" => Ok(Pillar::Perf),
            "compliance" => Ok(Pillar::Compliance),
            "docs" | "documentation" => Ok(Pillar::Docs),
            _ => Err(anyhow!("Unknown pillar: {}", s)),
        }
    }
}

impl std::fmt::Display for Pillar {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Pillar::Quality => write!(f, "quality"),
            Pillar::Security => write!(f, "security"),
            Pillar::Perf => write!(f, "perf"),
            Pillar::Compliance => write!(f, "compliance"),
            Pillar::Docs => write!(f, "docs"),
        }
    }
}

impl Pillar {
    pub fn all() -> [Pillar; 5] {
        [Pillar::Quality, Pillar::Security, Pillar::Perf, Pillar::Compliance, Pillar::Docs]
    }

    pub fn checks(&self) -> Vec<Check> {
        match self {
            Pillar::Quality => vec![
                Check::new("fmt", "cargo fmt --all -- --check", vec!["*.rs"]),
                Check::new("clippy", "cargo clippy --all-targets --all-features -- -D warnings", vec!["*.rs", "Cargo.toml"]),
                Check::new("check", "cargo check --all-targets --all-features", vec!["*.rs", "Cargo.toml"]),
                Check::new("test", "cargo nextest run --all-targets --all-features", vec!["*.rs", "Cargo.toml"]),
                Check::new("doc", "cargo doc --all-features --no-deps --document-private-items", vec!["*.rs", "Cargo.toml"]),
            ],
            Pillar::Security => vec![
                Check::new("audit", "cargo audit --deny warnings", vec!["Cargo.lock"]),
                Check::new("deny", "cargo deny check advisories bans licenses sources", vec!["Cargo.toml", "deny.toml", "Cargo.lock"]),
                Check::new("trufflehog", "trufflehog filesystem --directory=.", vec!["*"]),
            ],
            Pillar::Perf => vec![
                Check::new("bench", "cargo bench --all-features -- --save-baseline main", vec!["benches/**/*.rs", "src/**/*.rs"]),
                Check::new("size", "cargo bloat --release --time 10", vec!["src/**/*.rs", "Cargo.toml"]),
            ],
            Pillar::Compliance => vec![
                Check::new("deny-bans", "cargo deny check bans", vec!["Cargo.toml", "deny.toml", "Cargo.lock"]),
                Check::new("deny-licenses", "cargo deny check licenses", vec!["Cargo.toml", "deny.toml", "Cargo.lock"]),
                Check::new("spdx", "check-spdx-headers", vec!["*.rs"]),
                Check::new("sbom", "cargo cyclonedx --format json --output-target target/sbom.json", vec!["Cargo.toml", "Cargo.lock"]),
            ],
            Pillar::Docs => vec![
                Check::new("spellcheck", "codespell --skip=\"./target,./.git\"", vec!["*.md", "docs/**/*.md"]),
                Check::new("links", "cargo deadlinks", vec!["*.md", "docs/**/*.md", "src/**/*.rs"]),
                Check::new("api-docs", "cargo doc --all-features --no-deps --document-private-items 2>&1 | grep -q 'warning.*unresolved'", vec!["*.rs"]),
            ],
        }
    }

    /// Should this pillar be skipped based on changed files?
    pub fn should_skip(&self, changed_files: &[String]) -> Option<String> {
        let patterns = self.checks().into_iter().flat_map(|c| c.globs).collect::<Vec<_>>();
        let has_relevant = changed_files.iter().any(|f| {
            patterns.iter().any(|p| glob_match(p, f))
        });
        if !has_relevant {
            Some(format!("No relevant file changes for {}", self))
        } else {
            None
        }
    }

    pub fn run_checks(&self) -> Result<PillarResult> {
        let checks = self.checks();
        let mut results = HashMap::new();
        let mut total_duration = 0u64;
        let mut all_passed = true;

        for check in checks {
            info!("  Running check: {}", check.name);
            let start = Instant::now();

            let (passed, output, error) = run_check(&check);
            let duration = start.elapsed().as_millis() as u64;
            total_duration += duration;

            if !passed {
                all_passed = false;
            }

            results.insert(check.name.clone(), CheckResult {
                name: check.name.clone(),
                passed,
                duration_ms: duration,
                output: if output.is_empty() { None } else { Some(output) },
                error: if error.is_empty() { None } else { Some(error) },
                skipped: Some(false),
                skip_reason: None,
            });
        }

        Ok(PillarResult {
            passed: all_passed,
            checks: results,
            duration_ms: total_duration,
            skip_reason: None,
        })
    }
}

struct Check {
    name: String,
    command: String,
    globs: Vec<String>,
}

impl Check {
    fn new(name: &str, command: &str, globs: Vec<&str>) -> Self {
        Self {
            name: name.into(),
            command: command.into(),
            globs: globs.into_iter().map(|s| s.into()).collect(),
        }
    }
}

fn run_check(check: &Check) -> (bool, String, String) {
    let output = Command::new("sh")
        .arg("-c")
        .arg(&check.command)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let combined = format!("{}\n{}", stdout, stderr);
            (out.status.success(), combined, String::new())
        }
        Err(e) => (false, String::new(), format!("Failed to execute: {}", e)),
    }
}

/// Simple glob matching (supports * and **)
fn glob_match(pattern: &str, path: &str) -> bool {
    // Convert glob to regex-like matching
    let regex_pattern = pattern
        .replace(".", "\\.")
        .replace("**", ".*")
        .replace("*", "[^/]*");
    regex::Regex::new(&format!("^{}$", regex_pattern))
        .map(|re| re.is_match(path))
        .unwrap_or(false)
}

/// Run all checks for a pillar
pub fn run_pillar_checks(pillar: Pillar) -> Result<PillarResult> {
    pillar.run_checks()
}