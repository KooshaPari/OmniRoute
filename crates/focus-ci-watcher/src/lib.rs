// SPDX-License-Identifier: MIT OR Apache-2.0

//! FocalPoint CI Watcher — polls origin/main and triggers fastlane CI lanes.
//!
//! Polls git HEAD on a configurable interval; when new commits are detected,
//! clones into an isolated sandbox and runs fastlane ci. Failures post to Discord
//! via the release-bot webhook library.

use anyhow::{Context, Result};
use chrono::Utc;
use focus_release_bot::ReleaseNotesPayload;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

/// Poll result: (sha_changed, current_sha)
#[derive(Debug, Clone)]
pub struct PollResult {
    pub sha_changed: bool,
    pub current_sha: String,
    pub previous_sha: Option<String>,
}

/// Parse SHA from `git ls-remote origin main` output.
fn parse_git_sha(output: &str) -> Result<String> {
    output
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().next())
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("No SHA found in git ls-remote output"))
}

/// Get current HEAD SHA from git ls-remote.
pub fn get_remote_sha(repo_path: &Path) -> Result<String> {
    let output = Command::new("git")
        .args(["ls-remote", "origin", "main"])
        .current_dir(repo_path)
        .output()
        .context("Failed to run git ls-remote")?;

    if !output.status.success() {
        anyhow::bail!(
            "git ls-remote failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    let stdout = String::from_utf8(output.stdout)?;
    parse_git_sha(&stdout)
}

/// Create a temporary sandbox directory for CI run.
pub fn create_sandbox(temp_base: &Path) -> Result<PathBuf> {
    let sandbox_path = temp_base.join(format!("focalpoint-ci-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&sandbox_path)
        .context(format!("Failed to create sandbox: {:?}", sandbox_path))?;
    Ok(sandbox_path)
}

/// Clone repository into sandbox at a specific SHA.
pub fn clone_into_sandbox(repo_url: &str, sha: &str, sandbox_path: &Path) -> Result<()> {
    let status = Command::new("git")
        .args(["clone", repo_url, "."])
        .current_dir(sandbox_path)
        .status()
        .context("Failed to execute git clone")?;

    if !status.success() {
        anyhow::bail!("git clone failed");
    }

    // Checkout specific SHA
    let status = Command::new("git")
        .args(["checkout", sha])
        .current_dir(sandbox_path)
        .status()
        .context("Failed to execute git checkout")?;

    if !status.success() {
        anyhow::bail!("git checkout {} failed", sha);
    }

    Ok(())
}

/// Run fastlane ci in the sandbox and capture output.
/// Returns (success: bool, output: String).
pub fn run_fastlane_ci(sandbox_path: &Path) -> Result<(bool, String)> {
    let output = Command::new("fastlane")
        .args(["ci"])
        .current_dir(sandbox_path.join("apps/ios/FocalPoint"))
        .output()
        .context("Failed to execute fastlane ci")?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}\n{}", stdout, stderr);

    let success = output.status.success();
    Ok((success, combined))
}

/// Clean up sandbox directory.
pub fn cleanup_sandbox(path: &Path) -> Result<()> {
    if path.exists() {
        std::fs::remove_dir_all(path).context(format!("Failed to remove sandbox: {:?}", path))?;
    }
    Ok(())
}

/// Format CI result as Discord message payload.
pub fn format_ci_result(
    success: bool,
    sha: &str,
    output: &str,
    repo_name: &str,
) -> ReleaseNotesPayload {
    let mut categories = std::collections::BTreeMap::new();

    if success {
        categories.insert(
            "Added".to_string(),
            vec![format!("CI passed for {} ({})", repo_name, &sha[..8])],
        );
    } else {
        // Truncate output for Discord (2000 char limit per embed)
        let truncated = if output.len() > 1500 {
            format!("{}...", &output[..1500])
        } else {
            output.to_string()
        };
        categories.insert(
            "Fixed".to_string(),
            vec![format!("CI **FAILED** for {}\n\n```\n{}\n```", repo_name, truncated)],
        );
    }

    ReleaseNotesPayload::new(format!(
        "CI {} {}",
        if success { "✅" } else { "❌" },
        Utc::now().format("%Y-%m-%d %H:%M UTC")
    ))
    .with_category(if success { "Added" } else { "Fixed" }, categories
        .remove(if success { "Added" } else { "Fixed" })
        .unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_git_sha() {
        let output = "abc123def456  refs/heads/main\n";
        let sha = parse_git_sha(output).expect("parse failed");
        assert_eq!(sha, "abc123def456");
    }

    #[test]
    fn test_parse_git_sha_multiline() {
        let output = "abc123def456  refs/heads/main\nxyz789  refs/heads/develop\n";
        let sha = parse_git_sha(output).expect("parse failed");
        assert_eq!(sha, "abc123def456");
    }

    #[test]
    fn test_parse_git_sha_empty() {
        let output = "";
        let result = parse_git_sha(output);
        assert!(result.is_err());
    }

    #[test]
    fn test_sandbox_creation() {
        let temp_dir = std::env::temp_dir();
        let sandbox = create_sandbox(&temp_dir).expect("sandbox creation failed");
        assert!(sandbox.exists());
        // Cleanup
        let _ = cleanup_sandbox(&sandbox);
    }

    #[test]
    fn test_format_ci_result_success() {
        let payload = format_ci_result(true, "abc123def456", "", "FocalPoint");
        assert!(payload.version.contains("✅"));
    }

    #[test]
    fn test_format_ci_result_failure() {
        let payload = format_ci_result(false, "abc123def456", "test output", "FocalPoint");
        assert!(payload.version.contains("❌"));
    }

    #[test]
    fn test_format_ci_result_output_truncation() {
        let long_output = "x".repeat(2000);
        let payload = format_ci_result(false, "abc123def456", &long_output, "FocalPoint");
        assert!(payload.version.contains("❌"));
    }

    #[test]
    fn test_poll_result_struct() {
        let result = PollResult {
            sha_changed: true,
            current_sha: "abc123".to_string(),
            previous_sha: Some("def456".to_string()),
        };
        assert!(result.sha_changed);
        assert_eq!(result.current_sha, "abc123");
    }
}
