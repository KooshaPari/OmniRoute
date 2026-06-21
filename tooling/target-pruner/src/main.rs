// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Parser)]
#[command(name = "target-pruner")]
#[command(about = "Manage /repos target/ directories to prevent disk bloat")]
struct Cli {
    /// Dry run: list targets without removing (default)
    #[arg(long, default_value_t = true)]
    dry_run: bool,

    /// Remove targets older than N days
    #[arg(long)]
    prune: bool,

    /// Skip repos active in last N days (based on git commit recency OR file mtime)
    #[arg(long, default_value = "2")]
    keep_active_days: i64,

    /// Use access time (atime) instead of modification time (mtime) for staleness.
    /// Backward-compat only; atime is reset by `du`/cargo metadata reads during
    /// live multi-agent sessions, making it useless for emergency disk recovery.
    #[arg(long, default_value_t = false)]
    use_atime: bool,

    /// Maximum size per repo target/ dir (e.g., "500M", "1G")
    #[arg(long, default_value = "2G")]
    max_size: String,

    /// Path to config file (~/.config/phenotype/target-budget.toml)
    #[arg(long)]
    config: Option<PathBuf>,

    /// Number of top entries to display
    #[arg(long, default_value = "10")]
    top_n: usize,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct TargetBudgetConfig {
    #[serde(default)]
    global: GlobalConfig,
    #[serde(default)]
    repos: HashMap<String, RepoConfig>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct GlobalConfig {
    #[serde(default = "default_max_size")]
    max_size_bytes: u64,
    #[serde(default = "default_prune_days")]
    prune_days: i64,
    #[serde(default = "default_keep_active_days")]
    keep_active_days: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct RepoConfig {
    max_size_bytes: Option<u64>,
    prune_days: Option<i64>,
    keep_active_days: Option<i64>,
    exclude: Option<bool>,
}

fn default_max_size() -> u64 {
    2 * 1024 * 1024 * 1024 // 2GB
}

fn default_prune_days() -> i64 {
    7
}

fn default_keep_active_days() -> i64 {
    2
}

#[derive(Debug, Clone)]
struct TargetDir {
    path: PathBuf,
    size_bytes: u64,
    last_access: DateTime<Utc>,
}

fn parse_size(s: &str) -> Result<u64> {
    let s = s.trim().to_uppercase();
    let (num_str, multiplier) = if let Some(s) = s.strip_suffix("G") {
        (s, 1024u64 * 1024 * 1024)
    } else if let Some(s) = s.strip_suffix("M") {
        (s, 1024u64 * 1024)
    } else if let Some(s) = s.strip_suffix("K") {
        (s, 1024u64)
    } else {
        (&s[..], 1u64)
    };

    Ok(num_str.parse::<u64>()? * multiplier)
}

fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut idx = 0;

    while size >= 1024.0 && idx < UNITS.len() - 1 {
        size /= 1024.0;
        idx += 1;
    }

    format!("{:.2} {}", size, UNITS[idx])
}

fn get_dir_size(path: &Path) -> Result<u64> {
    let mut total = 0u64;
    for entry in WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            total = total.saturating_add(entry.metadata()?.len());
        }
    }
    Ok(total)
}

/// Returns the staleness timestamp for `path`.
///
/// Defaults to **mtime** (modification time): mtime tracks real edits/builds and
/// is not perturbed by metadata reads. When `use_atime` is true, falls back to
/// atime for backward compatibility — note that on APFS atime is reset by `du`,
/// cargo, and any file-stat walk, so it is unreliable during active sessions.
fn get_last_activity(path: &Path, use_atime: bool) -> Result<DateTime<Utc>> {
    let metadata = fs::metadata(path)?;
    let ts = if use_atime {
        metadata.accessed()?
    } else {
        metadata.modified()?
    };
    Ok(DateTime::<Utc>::from(ts))
}

fn find_target_dirs(repos_path: &Path, use_atime: bool) -> Result<Vec<TargetDir>> {
    let mut targets = Vec::new();

    for repo in WalkDir::new(repos_path)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = repo.path();
        if path.file_name().map_or(false, |n| n == "target") && path.is_dir() {
            let size = get_dir_size(path)?;
            let last_access = get_last_activity(path, use_atime)?;
            targets.push(TargetDir {
                path: path.to_path_buf(),
                size_bytes: size,
                last_access,
            });
        }
    }

    targets.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(targets)
}

fn load_config(path: Option<&PathBuf>) -> Result<TargetBudgetConfig> {
    let config_path = if let Some(p) = path {
        p.clone()
    } else {
        let mut p = dirs::config_dir().unwrap_or_else(|| PathBuf::from("~/.config"));
        p.push("phenotype/target-budget.toml");
        p
    };

    if config_path.exists() {
        let content = fs::read_to_string(&config_path)?;
        Ok(toml::from_str(&content)?)
    } else {
        Ok(TargetBudgetConfig::default())
    }
}

fn should_keep_active(repo_path: &Path, config: &TargetBudgetConfig, keep_active_days: i64) -> bool {
    let repo_name = repo_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("");

    let keep_days = config
        .repos
        .get(repo_name)
        .and_then(|r| r.keep_active_days)
        .unwrap_or(keep_active_days);

    if let Ok(metadata) = fs::metadata(repo_path.join(".git/HEAD")) {
        if let Ok(modified) = metadata.modified() {
            if let Ok(elapsed) = modified.elapsed() {
                let days_since_commit = elapsed.as_secs() / 86400;
                return days_since_commit < keep_days as u64;
            }
        }
    }
    false
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let config = load_config(cli.config.as_ref())?;

    let repos_path = Path::new("/Users/kooshapari/CodeProjects/Phenotype/repos");
    let targets = find_target_dirs(repos_path, cli.use_atime)?;

    if cli.verbose {
        if cli.use_atime {
            eprintln!(
                "Staleness source: atime (--use-atime; unreliable on APFS during active sessions)"
            );
        } else {
            eprintln!("Staleness source: mtime (default; reflects real file modifications)");
        }
    }

    if cli.verbose {
        eprintln!("Found {} target/ directories", targets.len());
    }

    println!("Target/ Directory Analysis\n");
    println!("{:<50} {:<15} {:<20}", "Repository", "Size", "Last Activity");
    println!("{}", "=".repeat(85));

    let total_size: u64 = targets.iter().take(cli.top_n).map(|t| t.size_bytes).sum();

    for (_idx, target) in targets.iter().take(cli.top_n).enumerate() {
        let repo_name = target
            .path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("?");

        let days_old = (Utc::now() - target.last_access).num_days();
        let access_str = if days_old <= 1 {
            "today".to_string()
        } else if days_old <= 7 {
            format!("{} days ago", days_old)
        } else {
            format!("{} weeks ago", days_old / 7)
        };

        println!(
            "{:<50} {:<15} {:<20}",
            repo_name,
            format_size(target.size_bytes),
            access_str
        );

        if cli.prune && !cli.dry_run {
            if should_keep_active(target.path.parent().unwrap(), &config, cli.keep_active_days) {
                if cli.verbose {
                    eprintln!("  → SKIP (active repo, <{} days)", cli.keep_active_days);
                }
                continue;
            }

            match fs::remove_dir_all(&target.path) {
                Ok(_) => println!("  → PRUNED ✓"),
                Err(e) => eprintln!("  → ERROR: {}", e),
            }
        }
    }

    println!("\n{}", "=".repeat(85));
    println!(
        "Total size (top {}): {} | Repos checked: {}",
        cli.top_n,
        format_size(total_size),
        targets.len()
    );

    if cli.dry_run {
        println!("\n(dry-run mode; use --prune to remove)");
    }

    Ok(())
}

mod dirs {
    use std::path::PathBuf;

    pub fn config_dir() -> Option<PathBuf> {
        std::env::var_os("XDG_CONFIG_HOME")
            .and_then(|s| if s.is_empty() { None } else { Some(s) })
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME").map(|h| {
                    let mut p = PathBuf::from(h);
                    p.push(".config");
                    p
                })
            })
    }
}
