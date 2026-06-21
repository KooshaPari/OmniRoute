// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{Context, Result};
use clap::Parser;
use focus_asset_fetcher::{
    download_asset, parse_sound_sources, FetcherConfig,
};
use std::fs;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "focalpoint-fetch-assets")]
#[command(about = "Download and post-process FocalPoint audio assets from SOUND_SOURCES.md", long_about = None)]
struct Args {
    /// Path to SOUND_SOURCES.md (default: apps/ios/FocalPoint/Resources/Audio/SOUND_SOURCES.md)
    #[arg(long, value_name = "FILE")]
    sources_file: Option<PathBuf>,

    /// Path to Simlish/SOURCES.md (optional, default: apps/ios/FocalPoint/Resources/Audio/Simlish/SOURCES.md)
    #[arg(long, value_name = "FILE")]
    simlish_file: Option<PathBuf>,

    /// Cache directory (default: .cache/asset-fetcher/)
    #[arg(long, value_name = "DIR")]
    cache_dir: Option<PathBuf>,

    /// Output directory for SFX (default: apps/ios/FocalPoint/Resources/Audio/SFX/)
    #[arg(long, value_name = "DIR")]
    output_sfx_dir: Option<PathBuf>,

    /// Output directory for Simlish (default: apps/ios/FocalPoint/Resources/Audio/Simlish/)
    #[arg(long, value_name = "DIR")]
    output_simlish_dir: Option<PathBuf>,

    /// Print plan without fetching
    #[arg(long)]
    dry_run: bool,

    /// Delay between requests in milliseconds (default: 500)
    #[arg(long)]
    request_delay_ms: Option<u64>,

    /// HTTP request timeout in seconds (default: 30)
    #[arg(long)]
    timeout_seconds: Option<u64>,
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    // Resolve paths
    let sources_file = args
        .sources_file
        .unwrap_or_else(|| {
            PathBuf::from("apps/ios/FocalPoint/Resources/Audio/SOUND_SOURCES.md")
        });

    let cache_dir = args
        .cache_dir
        .unwrap_or_else(|| PathBuf::from(".cache/asset-fetcher"));

    let output_sfx_dir = args
        .output_sfx_dir
        .unwrap_or_else(|| {
            PathBuf::from("apps/ios/FocalPoint/Resources/Audio/SFX")
        });

    let output_simlish_dir = args
        .output_simlish_dir
        .unwrap_or_else(|| {
            PathBuf::from("apps/ios/FocalPoint/Resources/Audio/Simlish")
        });

    // Load main sources
    let sources_content = fs::read_to_string(&sources_file)
        .context(format!("read {}", sources_file.display()))?;

    let assets = parse_sound_sources(&sources_content)
        .context("parse SOUND_SOURCES.md")?;

    println!("Fetching {} SFX assets...", assets.len());

    if args.dry_run {
        println!("\n[DRY RUN] Plan:");
    }

    let mut config = FetcherConfig::new(cache_dir.clone(), output_sfx_dir.clone(), output_simlish_dir.clone());
    config.dry_run = args.dry_run;
    if let Some(delay) = args.request_delay_ms {
        config.request_delay_ms = delay;
    }
    if let Some(timeout) = args.timeout_seconds {
        config.timeout_seconds = timeout;
    }

    // Fetch all assets
    for asset in assets {
        let cached_path = download_asset(&asset, &config)
            .context(format!("fetch {}", asset.name))?;

        if !args.dry_run {
            // Create output directory
            fs::create_dir_all(&config.output_sfx_dir)
                .context("create output SFX dir")?;

            // For now, just copy cached file (post-processing would happen here with ffmpeg check)
            let output_path = config.output_sfx_dir.join(format!("{}.m4a", asset.name));
            fs::copy(&cached_path, &output_path)
                .context(format!("copy asset to {}", output_path.display()))?;
        }
    }

    // Optionally load Simlish sources
    if let Some(simlish_file) = args.simlish_file {
        if simlish_file.exists() {
            let simlish_content = fs::read_to_string(&simlish_file)
                .context(format!("read {}", simlish_file.display()))?;

            let simlish_assets = parse_sound_sources(&simlish_content)
                .context("parse Simlish/SOURCES.md")?;

            println!("Fetching {} Simlish phonemes...", simlish_assets.len());

            for asset in simlish_assets {
                let cached_path = download_asset(&asset, &config)
                    .context(format!("fetch {}", asset.name))?;

                if !args.dry_run {
                    fs::create_dir_all(&config.output_simlish_dir)
                        .context("create output Simlish dir")?;

                    let output_path = config.output_simlish_dir.join(format!("{}.m4a", asset.name));
                    fs::copy(&cached_path, &output_path)
                        .context(format!("copy asset to {}", output_path.display()))?;
                }
            }
        }
    }

    if args.dry_run {
        println!("\n[DRY RUN] No assets downloaded.");
    } else {
        println!("\nAsset fetch complete.");
    }

    Ok(())
}
