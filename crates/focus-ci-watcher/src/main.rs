// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{Context, Result};
use clap::Parser;
use focus_ci_watcher::{
    cleanup_sandbox, clone_into_sandbox, create_sandbox, format_ci_result, get_remote_sha,
    run_fastlane_ci,
};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing::{error, info};

#[derive(Parser, Debug)]
#[command(name = "focus-ci-watcher")]
#[command(about = "Polls origin/main and triggers fastlane CI on new commits")]
struct Args {
    /// Main branch to track (default: main)
    #[arg(long, default_value = "main")]
    main_branch: String,

    /// Repository path (default: current dir)
    #[arg(long, default_value = ".")]
    repo_path: PathBuf,

    /// Poll interval in seconds (default: 300)
    #[arg(long, default_value = "300")]
    poll_interval_secs: u64,

    /// Environment variable name for Discord webhook URL
    #[arg(long, default_value = "FOCALPOINT_CI_WEBHOOK")]
    discord_webhook_env: String,

    /// Base directory for temporary sandboxes (default: /tmp)
    #[arg(long, default_value = "/tmp")]
    temp_base: PathBuf,

    /// Dry run: don't actually execute fastlane (useful for testing)
    #[arg(long)]
    dry_run: bool,

    /// Repository URL for cloning (default: origin remote)
    #[arg(long)]
    repo_url: Option<String>,
}

fn get_repo_url(repo_path: &Path) -> Result<String> {
    let output = std::process::Command::new("git")
        .args(["config", "--get", "remote.origin.url"])
        .current_dir(repo_path)
        .output()
        .context("Failed to get remote URL")?;

    if !output.status.success() {
        anyhow::bail!("Could not determine remote URL");
    }

    Ok(String::from_utf8(output.stdout)?
        .trim()
        .to_string())
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let args = Args::parse();

    info!(
        "Starting FocalPoint CI watcher (poll interval: {}s)",
        args.poll_interval_secs
    );

    // Get Discord webhook URL
    let webhook_url = std::env::var(&args.discord_webhook_env)
        .context(format!("Missing env var: {}", args.discord_webhook_env))?;

    // Get repository URL
    let repo_url = args
        .repo_url
        .clone()
        .or_else(|| get_repo_url(&args.repo_path).ok())
        .context("Could not determine repo URL")?;

    let mut last_sha: Option<String> = None;
    let poll_interval = Duration::from_secs(args.poll_interval_secs);

    loop {
        match get_remote_sha(&args.repo_path) {
            Ok(current_sha) => {
                if let Some(ref prev) = last_sha {
                    if prev != &current_sha {
                        info!("🔄 New commit detected: {} -> {}", &prev[..8], &current_sha[..8]);
                        handle_new_commit(&args, &current_sha, &repo_url, &webhook_url)
                            .await;
                        last_sha = Some(current_sha);
                    }
                } else {
                    info!("📍 Initial poll: {}", &current_sha[..8]);
                    last_sha = Some(current_sha);
                }
            }
            Err(e) => {
                error!("Failed to poll git: {}", e);
            }
        }

        tokio::time::sleep(poll_interval).await;
    }
}

async fn handle_new_commit(
    args: &Args,
    sha: &str,
    repo_url: &str,
    webhook_url: &str,
) {
    info!("🚀 Running CI for {}", &sha[..8]);

    let sandbox = match create_sandbox(&args.temp_base) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to create sandbox: {}", e);
            return;
        }
    };

    let _success = if args.dry_run {
        info!("[DRY RUN] Would clone {} into {:?}", repo_url, sandbox);
        true
    } else {
        match clone_into_sandbox(repo_url, sha, &sandbox) {
            Ok(()) => {
                match run_fastlane_ci(&sandbox) {
                    Ok((success, output)) => {
                        if success {
                            info!("✅ CI passed for {}", &sha[..8]);
                        } else {
                            error!("❌ CI failed for {}\n{}", &sha[..8], output);
                        }

                        // Post to Discord
                        let payload =
                            format_ci_result(success, sha, &output, "FocalPoint");
                        if let Err(e) =
                            focus_release_bot::post_to_webhook_blocking(webhook_url, payload)
                        {
                            error!("Failed to post Discord webhook: {}", e);
                        }

                        success
                    }
                    Err(e) => {
                        error!("Failed to run fastlane ci: {}", e);
                        false
                    }
                }
            }
            Err(e) => {
                error!("Failed to clone into sandbox: {}", e);
                false
            }
        }
    };

    // Cleanup sandbox
    if let Err(e) = cleanup_sandbox(&sandbox) {
        error!("Failed to cleanup sandbox: {}", e);
    } else {
        info!("🧹 Cleaned up sandbox");
    }
}
