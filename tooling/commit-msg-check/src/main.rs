// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{anyhow, Result};
use clap::Parser;
use regex::Regex;
use std::fs;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "commit-msg-check")]
#[command(about = "Validate commit message: conventional commits + DCO sign-off")]
struct Args {
    /// Path to commit message file (typically .git/COMMIT_EDITMSG)
    commit_msg_path: PathBuf,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let message = fs::read_to_string(&args.commit_msg_path)
        .map_err(|e| anyhow!("Failed to read commit message: {}", e))?;

    let message = message.trim();
    if message.is_empty() {
        return Err(anyhow!("Commit message is empty"));
    }

    // Check conventional commit format on first line
    let first_line = message.lines().next().unwrap_or("");
    validate_conventional_commit(first_line)?;

    // Check for DCO sign-off
    validate_dco_signoff(&message)?;

    Ok(())
}

fn validate_conventional_commit(first_line: &str) -> Result<()> {
    // Pattern: <type>(<scope>): <description> or <type>: <description>
    // Allow merge commits to bypass
    if first_line.starts_with("Merge ") {
        return Ok(());
    }

    let re = Regex::new(r"^(feat|fix|docs|chore|test|refactor|perf|ci)(\([^)]+\))?: .+")
        .expect("regex is valid");

    if !re.is_match(first_line) {
        return Err(anyhow!(
            "Invalid conventional commit format.\n\
             Expected: <type>(<scope>): <description>\n\
             Types: feat, fix, docs, chore, test, refactor, perf, ci\n\
             Got: {}",
            first_line
        ));
    }

    Ok(())
}

fn validate_dco_signoff(message: &str) -> Result<()> {
    // Look for "Signed-off-by:" line with email
    let has_dco = message
        .lines()
        .any(|line| line.trim().starts_with("Signed-off-by:") && line.contains('<') && line.contains('>'));

    if !has_dco {
        return Err(anyhow!(
            "Missing DCO sign-off.\n\
             Add to your commit: Signed-off-by: Your Name <your.email@example.com>\n\
             Or use: git commit -s -m \"...\""
        ));
    }

    Ok(())
}
