// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::info;

use agent_orchestrator::{disk_check, OrchestrationConfig, TrackerState};

#[derive(Parser)]
#[command(name = "agent-orchestrator")]
#[command(about = "Lane-based agent dispatch orchestration", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[arg(long, default_value = "orchestration.toml")]
    config: PathBuf,

    #[arg(long, default_value = ".orchestration-state.json")]
    state_file: PathBuf,
}

#[derive(Subcommand)]
enum Commands {
    /// List all configured lanes
    Lanes {
        #[command(subcommand)]
        command: LanesCommand,
    },
    /// Audit commits across lanes and generate coverage report
    Audit {
        #[arg(long)]
        since_commit: Option<String>,
    },
}

#[derive(Subcommand)]
enum LanesCommand {
    /// List all lanes and their scopes
    List,
    /// Get dispatch prompt for a specific lane
    Dispatch { lane_id: String },
    /// Show lane status from tracker
    Status,
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    if !cli.config.exists() {
        eprintln!("Error: orchestration.toml not found at {:?}", cli.config);
        eprintln!("Create one by copying orchestration.toml.example and editing it.");
        std::process::exit(1);
    }

    let config = OrchestrationConfig::from_file(&cli.config)?;
    config.validate_non_overlapping()?;

    match &cli.command {
        Commands::Lanes { command } => match command {
            LanesCommand::List => cmd_lanes_list(&config)?,
            LanesCommand::Dispatch { lane_id } => cmd_lanes_dispatch(&config, lane_id)?,
            LanesCommand::Status => cmd_lanes_status(&config, &cli.state_file)?,
        },
        Commands::Audit { since_commit } => cmd_audit(&config, since_commit.as_deref())?,
    }

    Ok(())
}

fn cmd_lanes_list(config: &OrchestrationConfig) -> Result<()> {
    println!("Available Lanes ({})\n", config.project_name);
    println!("{:<15} {:<25} {:<50}", "ID", "Name", "Scope");
    println!("{}", "=".repeat(90));

    for lane in &config.lanes {
        let scope_preview = lane.scope.join(", ");
        println!(
            "{:<15} {:<25} {:<50}",
            lane.id,
            lane.name,
            if scope_preview.len() > 50 {
                format!("{}...", &scope_preview[..47])
            } else {
                scope_preview
            }
        );
    }
    println!();

    info!("Listed {} lanes", config.lanes.len());
    Ok(())
}

fn cmd_lanes_dispatch(config: &OrchestrationConfig, lane_id: &str) -> Result<()> {
    // Pre-dispatch: Validate disk budget via disk-check binary (gated for safety)
    // Single agent counts as 1; orchestrator will sum parallel count from config
    disk_check::invoke_disk_check_gate(10, true)?;

    let lane = config
        .lanes
        .iter()
        .find(|l| l.id == lane_id)
        .ok_or_else(|| anyhow::anyhow!("Lane '{}' not found", lane_id))?;

    let files = config.get_lane_files(lane_id)?;

    println!("=== AGENT DISPATCH PROMPT ===\n");
    println!("Lane: {} ({})", lane.id, lane.name);
    println!("Files in scope: {}", files.len());
    println!("Scope patterns: {}\n", lane.scope.join(", "));

    println!("PROMPT:\n");
    println!("{}\n", lane.prompt_template);

    println!("COMMIT MESSAGE PREFIX:");
    println!("{}\n", lane.commit_message_prefix);

    println!("FILES:");
    let mut sorted_files: Vec<_> = files.iter().collect();
    sorted_files.sort();
    for file in sorted_files {
        println!("  {}", file);
    }

    info!(
        "Generated dispatch prompt for lane: {} ({} files)",
        lane.id,
        files.len()
    );
    Ok(())
}

fn cmd_lanes_status(config: &OrchestrationConfig, state_file: &std::path::PathBuf) -> Result<()> {
    let state = TrackerState::from_file(state_file)?;

    println!("Lane Status Report\n");
    println!(
        "{:<15} {:<20} {:<15} {:<20}",
        "Lane ID", "In Flight", "Coverage Count", "Last Dispatch"
    );
    println!("{}", "=".repeat(70));

    for lane in &config.lanes {
        let tracker = state.lanes.get(&lane.id);
        let in_flight = tracker.map(|t| t.in_flight).unwrap_or(false);
        let coverage_count = tracker.map(|t| t.coverage_count).unwrap_or(0);
        let last_dispatch = tracker
            .and_then(|t| t.last_dispatch.clone())
            .unwrap_or_else(|| "Never".to_string());

        println!(
            "{:<15} {:<20} {:<15} {:<20}",
            lane.id,
            if in_flight { "Yes" } else { "No" },
            coverage_count,
            if last_dispatch.len() > 20 {
                format!("{}...", &last_dispatch[..17])
            } else {
                last_dispatch
            }
        );
    }
    println!();

    info!("Lane status retrieved from {}", state_file.display());
    Ok(())
}

fn cmd_audit(config: &OrchestrationConfig, since_commit: Option<&str>) -> Result<()> {
    println!("Audit: Lane Coverage Analysis\n");
    println!("Project: {}", config.project_name);
    println!("Repo root: {}", config.repo_root);

    if let Some(since) = since_commit {
        println!("Analyzing commits since: {}\n", since);
    }

    println!("{:<15} {:<50}", "Lane", "Status");
    println!("{}", "=".repeat(65));

    let mut uncovered = 0;
    for lane in &config.lanes {
        let files = config.get_lane_files(&lane.id)?;
        let status = if files.is_empty() {
            uncovered += 1;
            "No files matched".to_string()
        } else {
            format!("{} files", files.len())
        };

        println!("{:<15} {:<50}", lane.id, status);
    }

    println!();
    if uncovered > 0 {
        println!(
            "Warning: {} lane(s) have no matching files. Check glob patterns.",
            uncovered
        );
    } else {
        println!("All lanes have matching files.");
    }

    info!("Audit complete");
    Ok(())
}
