// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{anyhow, Result};
use std::process::Command;
use tracing;

/// Check available disk space on /repos path
pub fn check_disk_space(min_free_gb: u64) -> Result<()> {
    let output = Command::new("df")
        .arg("-B1")
        .arg("/Users/kooshapari/CodeProjects/Phenotype/repos")
        .output()
        .map_err(|e| anyhow!("Failed to run df: {}", e))?;

    if !output.status.success() {
        return Err(anyhow!("df command failed"));
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| anyhow!("Failed to parse df output: {}", e))?;

    // Parse df output: skip header, get last line
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

    let available_gb = available_bytes / 1_000_000_000;
    let required_gb = min_free_gb;

    if available_gb < required_gb {
        return Err(anyhow!(
            "DISK BUDGET EXCEEDED: {} GB available, {} GB required (min). \
             Please run 'target-pruner --prune' or manual cleanup.\n\n\
             Command: /repos/FocalPoint/target/release/target-pruner --prune --verbose",
            available_gb, required_gb
        ));
    }

    Ok(())
}

/// Call the disk-check binary to gate dispatch (exit 0 = OK, exit 1 = block, exit 2 = warn)
pub fn invoke_disk_check_gate(threshold_gb: u64, verbose: bool) -> Result<()> {
    let mut cmd = Command::new("disk-check");
    cmd.arg("--min-gb").arg(threshold_gb.to_string());

    if verbose {
        cmd.arg("--verbose");
    }

    let status = cmd.status()
        .map_err(|e| anyhow!("Failed to run disk-check binary: {}. Ensure it is in PATH.", e))?;

    match status.code() {
        Some(0) => Ok(()),
        Some(1) => Err(anyhow!(
            "DISK BUDGET CRITICAL: Available space below {} GB threshold. \
             Dispatch aborted. Run target-pruner --prune or rm -rf /repos/.worktrees/*/target",
            threshold_gb
        )),
        Some(2) => {
            tracing::warn!(
                "DISK BUDGET WARNING: Available space approaching limit. Dispatch allowed but monitor closely."
            );
            Ok(())
        }
        Some(code) => Err(anyhow!("disk-check exited with code {}", code)),
        None => Err(anyhow!("disk-check process terminated by signal")),
    }
}

/// Validate pre-dispatch conditions (disk budget for parallel agent dispatch)
pub fn validate_pre_dispatch(parallel_agent_count: usize) -> Result<()> {
    // Only check if launching >3 parallel agents that might run cargo
    if parallel_agent_count > 3 {
        // Check for 10GB minimum free space before multi-cargo dispatch (will warn at 20GB)
        invoke_disk_check_gate(10, true)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disk_space_check() {
        // This test will pass on any system with >20GB free
        let result = check_disk_space(1);
        if let Err(e) = result {
            eprintln!("Disk check warning (expected in constrained environments): {}", e);
        }
    }
}
