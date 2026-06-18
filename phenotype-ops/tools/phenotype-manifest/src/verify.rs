//! Manifest verification logic

use crate::cli::{OutputFormat, VerifyArgs};
use crate::crypto::{load_verifying_key, verify_manifest};
use crate::manifest::{Manifest, VerificationResult};
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use std::fs;
use std::path::Path;
use tracing::{info, warn};

pub fn verify_manifest_cmd(args: VerifyArgs) -> Result<()> {
    info!("Verifying manifest: {}", args.manifest.display());

    // 1. Read manifest
    let content = fs::read_to_string(&args.manifest)
        .with_context(|| format!("Failed to read manifest: {}", args.manifest.display()))?;
    let manifest: Manifest = serde_json::from_str(&content)
        .context("Failed to parse manifest JSON")?;

    // 2. Load public key
    let pubkey = load_verifying_key(&args.pubkey)
        .with_context(|| format!("Failed to load public key: {}", args.pubkey.display()))?;

    // 3. Verify
    let result = verify_manifest(
        &manifest,
        &pubkey,
        args.require_all_pillars,
        args.min_health_score,
        args.max_age_hours,
    );

    // 4. Output
    match args.format {
        OutputFormat::Human => print_human(&result),
        OutputFormat::Json => println!("{}", serde_json::to_string_pretty(&result)?),
        OutputFormat::Github => print_github(&result),
    }

    // 5. Exit code
    if !result.valid {
        return Err(anyhow!("Manifest verification failed"));
    }

    if result.health_score.unwrap_or(0.0) < args.min_health_score {
        return Err(anyhow!("Health score below threshold"));
    }

    Ok(())
}

fn print_human(result: &VerificationResult) {
    if result.valid {
        println!("✅ Manifest VALID");
    } else {
        println!("❌ Manifest INVALID");
    }

    if let Some(health) = result.health_score {
        println!("Health: {:.1}%", health * 100.0);
    }

    println!("Pillars: {}/{} passed", result.pillars_passed, result.pillars_total);
    println!("Checks:  {}/{} passed", result.checks_passed, result.checks_total);

    if !result.errors.is_empty() {
        println!("\nErrors:");
        for e in &result.errors {
            println!("  ❌ {}", e);
        }
    }

    if !result.warnings.is_empty() {
        println!("\nWarnings:");
        for w in &result.warnings {
            println!("  ⚠️  {}", w);
        }
    }

    if let Some(manifest) = &result.manifest {
        println!("\n{}", manifest.format_human());
    }
}

fn print_github(result: &VerificationResult) {
    // GitHub Actions annotations
    for error in &result.errors {
        println!("::error::{}", error);
    }
    for warning in &result.warnings {
        println!("::warning::{}", warning);
    }

    if let Some(health) = result.health_score {
        println!("::notice::Health score: {:.1}%", health * 100.0);
    }
    println!("::notice::Pillars passed: {}/{}", result.pillars_passed, result.pillars_total);
    println!("::notice::Checks passed: {}/{}", result.checks_passed, result.checks_total);
}