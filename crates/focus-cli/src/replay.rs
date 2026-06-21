// SPDX-License-Identifier: MIT OR Apache-2.0

//! Time-travel replay subcommand: evaluate alternate rulesets against events.

use anyhow::anyhow;
use chrono::DateTime;
use clap::Subcommand;
use focus_replay::ReplayEngine;
use focus_rules::Rule;
use focus_storage::ports::RuleStore;
use focus_storage::SqliteAdapter;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Subcommand)]
pub enum ReplayCmd {
    /// Replay events in a time window under an alternate ruleset.
    #[command(about = "Time-travel debug: replay events under modified ruleset")]
    Window {
        /// Start of replay window (ISO 8601 format, e.g. 2026-04-20T00:00:00Z).
        #[arg(long, help = "Window start (ISO 8601)")]
        since: String,

        /// End of replay window (ISO 8601 format, e.g. 2026-04-21T00:00:00Z).
        #[arg(long, help = "Window end (ISO 8601)")]
        until: String,

        /// Path to alternate FPL ruleset file. Required.
        #[arg(long, help = "Path to alternate ruleset (FPL or TOML)")]
        rules: PathBuf,

        /// Output format: json, markdown (default: markdown).
        #[arg(long, default_value = "markdown")]
        format: String,
    },
}

/// Execute a replay operation.
pub async fn execute(
    adapter: Arc<SqliteAdapter>,
    cmd: ReplayCmd,
) -> anyhow::Result<String> {
    match cmd {
        ReplayCmd::Window {
            since,
            until,
            rules,
            format,
        } => replay_window(adapter, &since, &until, &rules, &format).await,
    }
}

async fn replay_window(
    adapter: Arc<SqliteAdapter>,
    since_str: &str,
    until_str: &str,
    rules_path: &PathBuf,
    format: &str,
) -> anyhow::Result<String> {
    // Parse timestamps.
    let since: DateTime<chrono::Utc> = since_str
        .parse()
        .map_err(|e| anyhow!("Invalid --since timestamp: {}", e))?;
    let until: DateTime<chrono::Utc> = until_str
        .parse()
        .map_err(|e| anyhow!("Invalid --until timestamp: {}", e))?;

    if since >= until {
        return Err(anyhow!("--since must be before --until"));
    }

    // Load baseline rules from adapter.
    let baseline_rules = adapter
        .list_enabled()
        .await
        .map_err(|e| anyhow!("Failed to load baseline rules: {}", e))?;

    // Load alternate ruleset from file.
    let rules_content = fs::read_to_string(rules_path)
        .map_err(|e| anyhow!("Failed to read ruleset file: {}", e))?;

    // Parse ruleset (support both TOML and FPL).
    let alternate_rules = if rules_path
        .extension()
        .map(|ext| ext == "fpl")
        .unwrap_or(false)
    {
        // FPL format (stub for now; would integrate with focus-lang).
        parse_fpl_ruleset(&rules_content)?
    } else {
        // TOML format.
        parse_toml_ruleset(&rules_content)?
    };

    // Create replay engine.
    let engine = ReplayEngine::new(adapter.clone(), baseline_rules, alternate_rules);

    // Replay the window.
    let report = engine
        .replay_window(since, until)
        .await
        .map_err(|e| anyhow!("Replay failed: {}", e))?;

    // Format output.
    match format {
        "json" => Ok(serde_json::to_string_pretty(&report)?),
        "markdown" => Ok(report.to_markdown()),
        other => Err(anyhow!("Unknown format: {}. Use 'json' or 'markdown'", other)),
    }
}

/// Parse a TOML ruleset file.
fn parse_toml_ruleset(content: &str) -> anyhow::Result<Vec<Rule>> {
    // Stub: in production, this would deserialize TOML into Rule structs.
    // For now, return an empty vec (tests will handle the parsing).
    let _rules: toml::Value = toml::from_str(content)
        .map_err(|e| anyhow!("Invalid TOML: {}", e))?;
    Ok(Vec::new())
}

/// Parse an FPL (Focus Policy Language) ruleset file.
fn parse_fpl_ruleset(content: &str) -> anyhow::Result<Vec<Rule>> {
    // Stub: in production, this would use focus-lang to compile FPL into Rule structs.
    // For now, return an empty vec (tests will handle the parsing).
    let _ = content;
    Ok(Vec::new())
}
