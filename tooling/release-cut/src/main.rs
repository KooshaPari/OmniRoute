// SPDX-License-Identifier: MIT OR Apache-2.0

//! release-cut: TestFlight release orchestration.
//!
//! Workflow:
//!   1. `release-cut v0.0.7 --dry-run` — emits a plan (git tag, version bumps, CHANGELOG, Discord post, fastlane invocation)
//!   2. `release-cut v0.0.7 --execute` — runs the plan
//!   3. `release-cut rollback v0.0.7` — reverts git tag + version bumps (keeps CHANGELOG)

use anyhow::{anyhow, Result};
use clap::{Parser, Subcommand};
use semver::Version;
use std::path::PathBuf;

mod executor;
mod planner;
mod version_bump;

use executor::Executor;
use planner::Planner;

#[derive(Parser)]
#[command(name = "release-cut")]
#[command(about = "End-to-end TestFlight release: tag, version, CHANGELOG, Discord, fastlane")]
#[command(version)]
struct Args {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Release version (e.g., release v0.0.7 or release v0.0.7 --execute)
    Release {
        /// Release version (semver, e.g., v0.0.7)
        version: String,

        /// Execute the plan (default: dry-run only)
        #[arg(long)]
        execute: bool,
    },

    /// Rollback: revert tag + version bumps (preserves CHANGELOG)
    Rollback {
        /// Release version to rollback (e.g., v0.0.7)
        version: String,
    },
}

fn main() -> Result<()> {
    let args = Args::parse();

    match args.command {
        Commands::Release { version, execute } => {
            let vers = parse_version(&version)?;
            let repo_root = find_repo_root()?;

            let planner = Planner::new(&repo_root);
            let plan = planner.plan_release(&vers)?;

            if execute {
                println!("\n>>> Executing release plan for {}\n", vers);
                let executor = Executor::new(&repo_root);
                executor.execute(&plan)?;
                println!("\n✅ Release {} complete", vers);
            } else {
                println!("\n>>> Dry-run: release plan for {}\n", vers);
                plan.print();
                println!(
                    "\nTo execute, run: release-cut release {} --execute\n",
                    version
                );
            }
        }

        Commands::Rollback { version } => {
            let vers = parse_version(&version)?;
            let repo_root = find_repo_root()?;

            println!("\n>>> Rolling back release {}\n", vers);
            let executor = Executor::new(&repo_root);
            executor.rollback(&vers)?;
            println!("\n✅ Rollback of {} complete", vers);
        }
    }

    Ok(())
}

fn parse_version(input: &str) -> Result<Version> {
    let cleaned = input.trim_start_matches('v');
    Version::parse(cleaned).map_err(|e| anyhow!("invalid semver '{}': {}", input, e))
}

fn find_repo_root() -> Result<PathBuf> {
    let mut current = std::env::current_dir()?;
    loop {
        if current.join(".git").exists() && current.join("Cargo.toml").exists() {
            return Ok(current);
        }
        if !current.pop() {
            return Err(anyhow!(
                "not in a git repo with Cargo.toml; run from FocalPoint root"
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    // Tests are in executor.rs and planner.rs modules
}
