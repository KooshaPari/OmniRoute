//! CLI argument definitions

use clap::{Args, ValueEnum};
use std::path::PathBuf;

#[derive(Args, Debug, Clone)]
pub struct GenerateArgs {
    /// Path to Ed25519 private key (PEM or raw)
    #[arg(long, short, default_value = "~/.ssh/manifest")]
    pub key: PathBuf,

    /// Output manifest path
    #[arg(long, short, default_value = ".manifest.signed.json")]
    pub output: PathBuf,

    /// Require all 5 pillars to pass
    #[arg(long, default_value = "true")]
    pub require_all_pillars: bool,

    /// Minimum health score 0.0-1.0 (fail if below)
    #[arg(long, default_value = "0.90")]
    pub fail_below: f64,

    /// Maximum manifest age in hours
    #[arg(long, default_value = "24")]
    pub max_age_hours: u64,

    /// Skip specific pillars (comma-separated)
    #[arg(long, value_delimiter = ',')]
    pub skip_pillars: Vec<String>,

    /// Output JSON to stdout instead of file
    #[arg(long)]
    pub stdout: bool,

    /// Show human-readable output
    #[arg(long, default_value = "true")]
    pub human: bool,
}

#[derive(Args, Debug, Clone)]
pub struct VerifyArgs {
    /// Path to signed manifest
    #[arg(long, short, default_value = ".manifest.signed.json")]
    pub manifest: PathBuf,

    /// Path to Ed25519 public key (PEM or raw)
    #[arg(long, short = 'p', default_value = ".github/manifest.pubkey.pem")]
    pub pubkey: PathBuf,

    /// Require all 5 pillars to be present
    #[arg(long, default_value = "true")]
    pub require_all_pillars: bool,

    /// Minimum health score 0.0-1.0
    #[arg(long, default_value = "0.90")]
    pub min_health_score: f64,

    /// Maximum manifest age in hours
    #[arg(long, default_value = "24")]
    pub max_age_hours: u64,

    /// Output format
    #[arg(long, value_enum, default_value = "human")]
    pub format: OutputFormat,

    /// Fail on warnings
    #[arg(long)]
    pub strict: bool,
}

#[derive(Args, Debug, Clone)]
pub struct ShowArgs {
    /// Path to signed manifest
    #[arg(default_value = ".manifest.signed.json")]
    pub manifest: PathBuf,

    /// Output as JSON
    #[arg(long)]
    pub json: bool,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum OutputFormat {
    Human,
    Json,
    Github,  // GitHub Actions annotations
}