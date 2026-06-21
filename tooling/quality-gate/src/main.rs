// SPDX-License-Identifier: MIT OR Apache-2.0

use std::env;
use std::process::{Command, exit};
use std::path::PathBuf;

#[derive(Debug)]
struct CheckResult {
    name: String,
    passed: bool,
    duration_ms: u128,
    error: Option<String>,
}

#[derive(Debug)]
struct Config {
    quick: bool,
    json_output: bool,
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = env::args().collect();
    let config = parse_args(&args);

    let mut results = Vec::new();

    // 1. cargo fmt --check
    results.push(run_check("cargo fmt --check", "Rust Format Check", false));
    if !results.last().unwrap().passed {
        print_results(&results, config.json_output);
        exit(1);
    }

    // 2. cargo clippy --workspace -- -D warnings
    results.push(run_check(
        "cargo clippy --workspace -- -D warnings",
        "Clippy Lint Check",
        false,
    ));
    if !results.last().unwrap().passed {
        print_results(&results, config.json_output);
        exit(1);
    }

    // 3. cargo test --workspace --no-fail-fast (skip if --quick)
    if !config.quick {
        results.push(run_check(
            "cargo test --workspace --no-fail-fast",
            "Unit Tests",
            false,
        ));
        if !results.last().unwrap().passed {
            print_results(&results, config.json_output);
            exit(1);
        }
    }

    // 4. cargo doc --workspace --no-deps (skip if --quick)
    if !config.quick {
        results.push(run_check(
            "cargo doc --workspace --no-deps 2>&1 | grep -i warning",
            "Documentation Build",
            true,
        ));
        if !results.last().unwrap().passed {
            print_results(&results, config.json_output);
            exit(1);
        }
    }

    // 5. cargo deny check --hide-inclusion-graph (if deny.toml exists)
    if PathBuf::from("deny.toml").exists() {
        results.push(run_check(
            "cargo deny check --hide-inclusion-graph",
            "Cargo Deny Check",
            false,
        ));
        if !results.last().unwrap().passed {
            print_results(&results, config.json_output);
            exit(1);
        }
    }

    // 6. FR coverage check
    if PathBuf::from("tooling/fr-coverage/target/release/fr-coverage").exists() {
        results.push(run_check(
            "tooling/fr-coverage/target/release/fr-coverage",
            "FR Coverage Check",
            false,
        ));
        if !results.last().unwrap().passed {
            print_results(&results, config.json_output);
            exit(1);
        }
    }

    // 7. bun run build in apps/builder/ (if bun.lockb present)
    if !config.quick && PathBuf::from("apps/builder/bun.lockb").exists() {
        results.push(run_check(
            "cd apps/builder && bun run build && cd ../..",
            "Builder Build",
            false,
        ));
        if !results.last().unwrap().passed {
            print_results(&results, config.json_output);
            exit(1);
        }
    }

    // 8. doc-link-check
    if !config.quick && PathBuf::from("tooling/doc-link-check/target/release/doc-link-check").exists() {
        results.push(run_check(
            "tooling/doc-link-check/target/release/doc-link-check",
            "Documentation Link Check",
            false,
        ));
        if !results.last().unwrap().passed {
            print_results(&results, config.json_output);
            exit(1);
        }
    }

    print_results(&results, config.json_output);
    println!("\n✅ Quality gate passed!");
    Ok(())
}

fn parse_args(args: &[String]) -> Config {
    Config {
        quick: args.contains(&"--quick".to_string()),
        json_output: args.contains(&"--format=json".to_string()),
    }
}

fn run_check(cmd: &str, name: &str, invert_exit: bool) -> CheckResult {
    let start = std::time::Instant::now();
    let output = Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .output();

    let duration_ms = start.elapsed().as_millis();

    match output {
        Ok(output) => {
            let success = if invert_exit {
                !output.status.success()
            } else {
                output.status.success()
            };

            if success {
                CheckResult {
                    name: name.to_string(),
                    passed: true,
                    duration_ms,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let error_msg = if !stderr.is_empty() {
                    stderr.to_string()
                } else {
                    stdout.to_string()
                };

                CheckResult {
                    name: name.to_string(),
                    passed: false,
                    duration_ms,
                    error: Some(error_msg.trim().to_string()),
                }
            }
        }
        Err(e) => CheckResult {
            name: name.to_string(),
            passed: false,
            duration_ms,
            error: Some(format!("Failed to run: {}", e)),
        },
    }
}

fn print_results(results: &[CheckResult], json_output: bool) {
    if json_output {
        let json = serde_json::json!({
            "checks": results.iter().map(|r| {
                serde_json::json!({
                    "name": r.name,
                    "passed": r.passed,
                    "duration_ms": r.duration_ms,
                    "error": r.error
                })
            }).collect::<Vec<_>>(),
            "total": results.len(),
            "passed": results.iter().filter(|r| r.passed).count(),
            "failed": results.iter().filter(|r| !r.passed).count(),
        });
        println!("{}", serde_json::to_string_pretty(&json).unwrap());
    } else {
        println!("\n╔════════════════════════════════════════════════════════╗");
        println!("║           QUALITY GATE REPORT                          ║");
        println!("╚════════════════════════════════════════════════════════╝");
        println!();

        for result in results {
            let status = if result.passed { "✓" } else { "✗" };
            println!("{} {} ({} ms)", status, result.name, result.duration_ms);
            if let Some(err) = &result.error {
                println!("  └─ {}", err.lines().next().unwrap_or("Unknown error"));
            }
        }

        println!();
        let total = results.len();
        let passed = results.iter().filter(|r| r.passed).count();
        let failed = results.iter().filter(|r| !r.passed).count();

        println!("Summary: {}/{} passed, {} failed", passed, total, failed);
    }
}
