// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{anyhow, Result};
use clap::Parser;
use std::process::Command;

#[derive(Parser)]
#[command(name = "disk-check")]
#[command(about = "Pre-dispatch disk space gate: exit 0 if >=30GB free, exit 2 if 10-30GB (warn), exit 1 if <10GB (block)")]
struct Args {
    /// Minimum free space in GB to allow dispatch (default: 30)
    #[arg(long, default_value = "30")]
    min_gb: u64,

    /// Warning threshold in GB (exit 2 if between warn_gb and min_gb, default: 10)
    #[arg(long, default_value = "10")]
    warn_gb: u64,

    /// Path to check (default: /System/Volumes/Data)
    #[arg(long, default_value = "/System/Volumes/Data")]
    path: String,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
}

fn check_disk_space(path: &str) -> Result<u64> {
    let output = Command::new("df")
        .arg("-B1")
        .arg(path)
        .output()
        .map_err(|e| anyhow!("Failed to run df: {}", e))?;

    if !output.status.success() {
        return Err(anyhow!("df command failed"));
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| anyhow!("Failed to parse df output: {}", e))?;

    let lines: Vec<&str> = stdout.lines().collect();
    if lines.len() < 2 {
        return Err(anyhow!("Unexpected df output format"));
    }

    let fields: Vec<&str> = lines[1].split_whitespace().collect();
    if fields.len() < 4 {
        return Err(anyhow!("Unexpected df output format"));
    }

    let available_bytes: u64 = fields[3]
        .parse()
        .map_err(|e| anyhow!("Failed to parse available bytes: {}", e))?;

    Ok(available_bytes / 1_000_000_000)
}

fn main() -> Result<()> {
    let args = Args::parse();

    let available_gb = check_disk_space(&args.path)?;

    if args.verbose {
        eprintln!("DISK CHECK: {} GB available (path: {})", available_gb, args.path);
        eprintln!(
            "Thresholds: min={}GB (exit 1), warn={}GB (exit 2), ok=>{} (exit 0)",
            args.warn_gb, args.min_gb, args.min_gb
        );
    }

    if available_gb < args.warn_gb {
        eprintln!(
            "DISK BUDGET CRITICAL: {} GB available (< {} GB threshold)\n\
             Run: rm -rf /Users/kooshapari/CodeProjects/Phenotype/repos/.worktrees/*/target\n\
             Then re-check: disk-check --verbose",
            available_gb, args.warn_gb
        );
        std::process::exit(1);
    }

    if available_gb < args.min_gb {
        eprintln!(
            "DISK BUDGET WARNING: {} GB available (< {} GB min, but >= {} GB safe threshold)\n\
             Consider purging: rm -rf /Users/kooshapari/CodeProjects/Phenotype/repos/.worktrees/*/target",
            available_gb, args.min_gb, args.warn_gb
        );
        std::process::exit(2);
    }

    if args.verbose {
        eprintln!("DISK CHECK OK: {} GB available (>= {} GB min)", available_gb, args.min_gb);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disk_check_current_system() {
        // This will pass on any system with >10GB free
        let result = check_disk_space("/System/Volumes/Data");
        assert!(result.is_ok(), "Disk check should succeed on normal systems");
        if let Ok(available) = result {
            println!("Current disk available: {} GB", available);
        }
    }
}
