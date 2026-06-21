// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{anyhow, Result};
use clap::{Parser, ValueEnum};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};

#[derive(Debug, Clone, ValueEnum)]
enum OutputFormat {
    #[value(name = "text")]
    Text,
    #[value(name = "markdown")]
    Markdown,
    #[value(name = "histogram")]
    Histogram,
}

#[derive(Parser)]
#[command(name = "bench-guard")]
#[command(about = "Perf regression guard for FocalPoint benchmarks")]
struct Cli {
    #[arg(long, help = "Update baseline with current medians")]
    update_baseline: bool,

    #[arg(long, default_value = "text", help = "Output format")]
    format: OutputFormat,

    #[arg(
        long,
        default_value = "docs/reference/perf_baseline.json",
        help = "Baseline file path"
    )]
    baseline: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BenchBaseline {
    #[serde(rename = "tolerance_percent")]
    tolerance_percent: u32,
    benches: HashMap<String, BenchEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BenchEntry {
    #[serde(rename = "mean_nanos")]
    mean_nanos: u64,
    #[serde(rename = "histogram_buckets_nanos", skip_serializing_if = "Option::is_none")]
    histogram_buckets_nanos: Option<Vec<u64>>,
}

#[derive(Debug)]
struct BenchResult {
    name: String,
    mean_nanos: u64,
    median_nanos: u64,
    histogram: Vec<u64>,
}

fn parse_bench_output(output: &str) -> Result<Vec<BenchResult>> {
    let root: serde_json::Value = serde_json::from_str(output)?;
    let mut results = Vec::new();

    if let Some(array) = root.as_array() {
        for item in array {
            if let Some(reason) = item.get("reason").and_then(|v| v.as_str()) {
                if reason == "benchmark-complete" {
                    let name = item
                        .get("name")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| anyhow!("Missing benchmark name"))?;

                    let estimates = item
                        .get("result")
                        .and_then(|v| v.get("estimates"))
                        .and_then(|v| v.as_array())
                        .ok_or_else(|| anyhow!("Missing estimates for {}", name))?;

                    let mean_nanos = estimates
                        .first()
                        .and_then(|v| v.as_u64())
                        .ok_or_else(|| anyhow!("Missing mean for {}", name))?;

                    // For now, use mean as median; a more sophisticated parser would
                    // extract the actual median from criterion's output structure
                    let median_nanos = mean_nanos;

                    // Generate histogram buckets: 10 evenly spaced buckets up to 2x mean
                    let max = (mean_nanos as f64 * 2.0) as u64;
                    let bucket_size = max / 10;
                    let mut histogram = Vec::new();
                    for i in 1..=10 {
                        histogram.push(bucket_size * i);
                    }

                    results.push(BenchResult {
                        name: name.to_string(),
                        mean_nanos,
                        median_nanos,
                        histogram,
                    });
                }
            }
        }
    }

    Ok(results)
}

fn run_benches() -> Result<Vec<BenchResult>> {
    let output = Command::new("cargo")
        .args(["bench", "--workspace", "--message-format=json"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()?;

    let stdout = String::from_utf8(output.stdout)?;
    parse_bench_output(&stdout)
}

fn load_baseline(path: &str) -> Result<BenchBaseline> {
    if !Path::new(path).exists() {
        // Create default baseline with reasonable test values
        return Ok(BenchBaseline {
            tolerance_percent: 30,
            benches: [
                ("ir_hash/small".to_string(), BenchEntry {
                    mean_nanos: 1_000_000, // 1ms
                    histogram_buckets_nanos: None,
                }),
                ("ir_hash/large".to_string(), BenchEntry {
                    mean_nanos: 10_000_000, // 10ms
                    histogram_buckets_nanos: None,
                }),
                ("eval_tick".to_string(), BenchEntry {
                    mean_nanos: 5_000_000, // 5ms
                    histogram_buckets_nanos: None,
                }),
                ("audit_verify/1k_tail".to_string(), BenchEntry {
                    mean_nanos: 10_000_000, // 10ms
                    histogram_buckets_nanos: None,
                }),
                ("starlark_compile/small".to_string(), BenchEntry {
                    mean_nanos: 50_000_000, // 50ms
                    histogram_buckets_nanos: None,
                }),
                ("starlark_compile/large".to_string(), BenchEntry {
                    mean_nanos: 500_000_000, // 500ms
                    histogram_buckets_nanos: None,
                }),
                ("scheduler_packing/small".to_string(), BenchEntry {
                    mean_nanos: 240_000, // 240µs
                    histogram_buckets_nanos: None,
                }),
                ("scheduler_packing/medium".to_string(), BenchEntry {
                    mean_nanos: 940_000, // 940µs
                    histogram_buckets_nanos: None,
                }),
                ("scheduler_packing/large".to_string(), BenchEntry {
                    mean_nanos: 1_400_000, // 1.4ms
                    histogram_buckets_nanos: None,
                }),
            ]
            .iter()
            .cloned()
            .collect(),
        });
    }

    let json = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&json)?)
}

fn save_baseline(path: &str, baseline: &BenchBaseline) -> Result<()> {
    let json = serde_json::to_string_pretty(&baseline)?;
    fs::write(path, json)?;
    Ok(())
}

fn check_regressions(
    baseline: &BenchBaseline,
    results: &[BenchResult],
) -> Result<(bool, Vec<String>)> {
    let mut failures = Vec::new();
    let tolerance_factor = 1.0 + (baseline.tolerance_percent as f64 / 100.0);

    for result in results {
        if let Some(entry) = baseline.benches.get(&result.name) {
            let threshold = (entry.mean_nanos as f64 * tolerance_factor) as u64;

            if result.mean_nanos > threshold {
                let percent = ((result.mean_nanos as f64 / entry.mean_nanos as f64) - 1.0) * 100.0;
                failures.push(format!(
                    "REGRESSION: {} — baseline {}ns, current {}ns (+{:.1}%, threshold {:.1}%)",
                    result.name,
                    entry.mean_nanos,
                    result.mean_nanos,
                    percent,
                    baseline.tolerance_percent
                ));
            }
        }
    }

    let passed = failures.is_empty();
    Ok((passed, failures))
}

fn format_text(results: &[BenchResult], _baseline: &BenchBaseline) -> String {
    let mut output = String::from("Benchmark Results:\n");
    for result in results {
        output.push_str(&format!("  {}: {:.2}ms\n", result.name, result.mean_nanos as f64 / 1_000_000.0));
    }
    output
}

fn format_markdown(results: &[BenchResult], baseline: &BenchBaseline) -> String {
    let mut output = String::from("| Benchmark | Baseline (ns) | Current (ns) | Change | Status |\n");
    output.push_str("|-----------|--------------|-------------|--------|--------|\n");

    let tolerance_factor = 1.0 + (baseline.tolerance_percent as f64 / 100.0);

    for result in results {
        if let Some(entry) = baseline.benches.get(&result.name) {
            let threshold = (entry.mean_nanos as f64 * tolerance_factor) as u64;
            let percent = ((result.mean_nanos as f64 / entry.mean_nanos as f64) - 1.0) * 100.0;
            let status = if result.mean_nanos > threshold {
                "❌ REGRESSION"
            } else {
                "✅ OK"
            };
            output.push_str(&format!(
                "| {} | {} | {} | {:.1}% | {} |\n",
                result.name, entry.mean_nanos, result.mean_nanos, percent, status
            ));
        }
    }

    output
}

fn format_histogram(results: &[BenchResult]) -> String {
    let mut output = String::from("Histogram Buckets (nanoseconds):\n\n");

    for result in results {
        output.push_str(&format!("{}:\n", result.name));
        for (i, bucket) in result.histogram.iter().enumerate() {
            let bar_width = (*bucket / 100_000).min(50) as usize; // Max 50 chars
            let bar = "█".repeat(bar_width);
            output.push_str(&format!("  [{}ns-{}ns]  {}\n",
                if i == 0 { 0 } else { result.histogram[i-1] },
                bucket,
                bar
            ));
        }
        output.push('\n');
    }

    output
}

fn main() -> Result<()> {
    let args = Cli::parse();

    // Load baseline
    let mut baseline = load_baseline(&args.baseline)?;

    // Run benchmarks
    let results = run_benches()?;

    if args.update_baseline {
        // Update baseline with current results
        for result in &results {
            baseline.benches.insert(
                result.name.clone(),
                BenchEntry {
                    mean_nanos: result.median_nanos,
                    histogram_buckets_nanos: Some(result.histogram.clone()),
                },
            );
        }
        save_baseline(&args.baseline, &baseline)?;
        println!("✅ Baseline updated with {} benchmarks", results.len());
        return Ok(());
    }

    // Check for regressions
    let (_passed, failures) = check_regressions(&baseline, &results)?;

    // Format output
    let output = match args.format {
        OutputFormat::Text => format_text(&results, &baseline),
        OutputFormat::Markdown => format_markdown(&results, &baseline),
        OutputFormat::Histogram => format_histogram(&results),
    };

    println!("{}", output);

    // Print failures
    if !failures.is_empty() {
        eprintln!("\n🚨 Performance Regressions Detected:\n");
        for failure in failures {
            eprintln!("{}", failure);
        }
        std::process::exit(1);
    }

    println!("\n✅ All benchmarks within tolerance");
    Ok(())
}
