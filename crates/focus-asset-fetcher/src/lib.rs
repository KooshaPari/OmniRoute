// SPDX-License-Identifier: MIT OR Apache-2.0

//! FocalPoint audio asset fetcher.
//!
//! Downloads SFX and phoneme samples from SOUND_SOURCES.md, post-processes via ffmpeg,
//! and caches locally for incremental builds.

use anyhow::{anyhow, Context, Result};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use url::Url;

/// Parser result for a single asset line.
#[derive(Debug, Clone, PartialEq)]
pub struct AssetSpec {
    pub name: String,
    pub url: String,
    pub trim_start_seconds: Option<f32>,
    pub trim_duration_seconds: Option<f32>,
    pub pitch_semitones: Option<f32>,
    pub gain_db: Option<f32>,
}

/// Configuration for the asset fetcher.
#[derive(Debug, Clone)]
pub struct FetcherConfig {
    pub cache_dir: PathBuf,
    pub output_sfx_dir: PathBuf,
    pub output_simlish_dir: PathBuf,
    pub dry_run: bool,
    pub request_delay_ms: u64,
    pub timeout_seconds: u64,
}

impl FetcherConfig {
    pub fn new(cache_dir: PathBuf, output_sfx_dir: PathBuf, output_simlish_dir: PathBuf) -> Self {
        Self {
            cache_dir,
            output_sfx_dir,
            output_simlish_dir,
            dry_run: false,
            request_delay_ms: 500,
            timeout_seconds: 30,
        }
    }

    pub fn with_dry_run(mut self, dry_run: bool) -> Self {
        self.dry_run = dry_run;
        self
    }
}

/// Parse a single asset specification line (name url [--flag value]*).
///
/// Examples:
/// - `session-start-chime https://example.com/chime.mp3`
/// - `focus-ambient-loop https://example.com/loop.mp3 --start 1.5 --duration 60 --pitch 2 --gain -3`
pub fn parse_asset_line(line: &str) -> Result<AssetSpec> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return Err(anyhow!("empty or comment line"));
    }

    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err(anyhow!("asset line must have at least <name> <url>"));
    }

    let name = parts[0].to_string();
    let url_str = parts[1];

    // Validate URL is reachable-looking
    Url::parse(url_str).context("invalid URL")?;

    let mut trim_start = None;
    let mut trim_duration = None;
    let mut pitch = None;
    let mut gain = None;

    let mut i = 2;
    while i < parts.len() {
        match parts[i] {
            "--start" => {
                i += 1;
                if i >= parts.len() {
                    return Err(anyhow!("--start requires a value"));
                }
                trim_start = Some(parts[i].parse::<f32>().context("--start must be a float")?);
            }
            "--duration" => {
                i += 1;
                if i >= parts.len() {
                    return Err(anyhow!("--duration requires a value"));
                }
                trim_duration = Some(parts[i].parse::<f32>().context("--duration must be a float")?);
            }
            "--pitch" => {
                i += 1;
                if i >= parts.len() {
                    return Err(anyhow!("--pitch requires a value"));
                }
                pitch = Some(parts[i].parse::<f32>().context("--pitch must be a float")?);
            }
            "--gain" => {
                i += 1;
                if i >= parts.len() {
                    return Err(anyhow!("--gain requires a value"));
                }
                gain = Some(parts[i].parse::<f32>().context("--gain must be a float")?);
            }
            _ => {
                return Err(anyhow!("unknown flag: {}", parts[i]));
            }
        }
        i += 1;
    }

    Ok(AssetSpec {
        name,
        url: url_str.to_string(),
        trim_start_seconds: trim_start,
        trim_duration_seconds: trim_duration,
        pitch_semitones: pitch,
        gain_db: gain,
    })
}

/// Parse all assets from a SOUND_SOURCES.md file.
/// Extracts lines between markdown tables and ignores headers/pipes.
pub fn parse_sound_sources(content: &str) -> Result<Vec<AssetSpec>> {
    let mut specs = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip headers, separators, empty lines, and markdown table syntax
        if trimmed.is_empty()
            || trimmed.starts_with('#')
            || trimmed.starts_with('|')
            || trimmed.starts_with('-')
        {
            continue;
        }

        // Try to parse as asset line
        match parse_asset_line(trimmed) {
            Ok(spec) => specs.push(spec),
            Err(_) => {
                // Silently skip unparseable lines (descriptive text, etc.)
            }
        }
    }

    Ok(specs)
}

/// Build ffmpeg command arguments for post-processing.
pub fn ffmpeg_command(asset: &AssetSpec, input_path: &Path, output_path: &Path) -> Vec<String> {
    let mut cmd = vec![
        "ffmpeg".to_string(),
        "-i".to_string(),
        input_path.to_string_lossy().to_string(),
    ];

    // Trim (atrim filter)
    if asset.trim_start_seconds.is_some() || asset.trim_duration_seconds.is_some() {
        let start = asset.trim_start_seconds.unwrap_or(0.0);
        let duration_part = asset
            .trim_duration_seconds
            .map(|d| format!("=d={}", d))
            .unwrap_or_default();
        cmd.push("-af".to_string());
        cmd.push(format!("atrim=start={}{}", start, duration_part));
    }

    // Pitch shift (rubberband filter)
    if let Some(semitones) = asset.pitch_semitones {
        cmd.push("-af".to_string());
        cmd.push(format!("rubberband=pitch={}", 2_f32.powf(semitones / 12.0)));
    }

    // Gain normalize
    if let Some(gain_db) = asset.gain_db {
        cmd.push("-af".to_string());
        cmd.push(format!("volume={}dB", gain_db));
    } else {
        // Default normalization to -3 dBFS if no explicit gain
        cmd.push("-af".to_string());
        cmd.push("loudnorm=I=-23:TP=-1.5:LRA=11".to_string());
    }

    // Output format: m4a (AAC)
    cmd.push("-c:a".to_string());
    cmd.push("aac".to_string());
    cmd.push("-b:a".to_string());
    cmd.push("128k".to_string());
    cmd.push("-ar".to_string());
    cmd.push("48000".to_string());
    cmd.push(output_path.to_string_lossy().to_string());

    cmd
}

/// Compute SHA-256 hash of a file for cache-hit detection.
pub fn file_sha256(path: &Path) -> Result<String> {
    let data = fs::read(path).context("read file for hashing")?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

/// Check if a cached asset is still valid (by URL hash).
fn cache_hit(cache_dir: &Path, asset: &AssetSpec) -> Result<Option<PathBuf>> {
    let cache_name = format!("{}.cache", asset.name);
    let cache_path = cache_dir.join(&cache_name);

    if !cache_path.exists() {
        return Ok(None);
    }

    // Read metadata: URL hash on first line, downloaded file hash on second
    let content = fs::read_to_string(&cache_path)?;
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() < 2 {
        return Ok(None);
    }

    let expected_url_hash = lines[0];
    let mut hasher = Sha256::new();
    hasher.update(asset.url.as_bytes());
    let actual_url_hash = hex::encode(hasher.finalize());

    // If URL changed, invalidate cache
    if expected_url_hash != actual_url_hash {
        let _ = fs::remove_file(&cache_path);
        return Ok(None);
    }

    let cached_file = cache_dir.join(format!("{}.bin", asset.name));
    if !cached_file.exists() {
        return Ok(None);
    }

    Ok(Some(cached_file))
}

/// Download a single asset; uses cache if URL hash matches.
pub fn download_asset(
    asset: &AssetSpec,
    config: &FetcherConfig,
) -> Result<PathBuf> {
    // Respect robots.txt conceptually (simple delay)
    std::thread::sleep(Duration::from_millis(config.request_delay_ms));

    // Check cache
    if let Ok(Some(cached_path)) = cache_hit(&config.cache_dir, asset) {
        println!("  {} (cached)", asset.name);
        return Ok(cached_path);
    }

    println!("  {} (downloading from {})", asset.name, asset.url);

    if config.dry_run {
        let dummy_path = config.cache_dir.join(format!("{}.bin", asset.name));
        return Ok(dummy_path);
    }

    // Fetch from URL
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(config.timeout_seconds))
        .build()
        .context("build http client")?;

    let response = client
        .get(&asset.url)
        .send()
        .context(format!("fetch {}", asset.url))?;

    if !response.status().is_success() {
        return Err(anyhow!(
            "fetch failed for {}: {}",
            asset.name,
            response.status()
        ));
    }

    let bytes = response.bytes().context("read response body")?;

    // Store in cache
    fs::create_dir_all(&config.cache_dir).context("create cache dir")?;
    let cache_file = config.cache_dir.join(format!("{}.bin", asset.name));
    fs::write(&cache_file, &bytes).context("write cached asset")?;

    // Write metadata: URL hash + file hash
    let mut url_hasher = Sha256::new();
    url_hasher.update(asset.url.as_bytes());
    let url_hash = hex::encode(url_hasher.finalize());

    let mut file_hasher = Sha256::new();
    file_hasher.update(&bytes);
    let file_hash = hex::encode(file_hasher.finalize());

    let cache_meta = config.cache_dir.join(format!("{}.cache", asset.name));
    fs::write(&cache_meta, format!("{}\n{}", url_hash, file_hash))
        .context("write cache metadata")?;

    Ok(cache_file)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_asset_line_minimal() {
        let line = "session-start-chime https://example.com/chime.mp3";
        let spec = parse_asset_line(line).expect("parse");
        assert_eq!(spec.name, "session-start-chime");
        assert_eq!(spec.url, "https://example.com/chime.mp3");
        assert_eq!(spec.trim_start_seconds, None);
        assert_eq!(spec.trim_duration_seconds, None);
    }

    #[test]
    fn test_parse_asset_line_with_flags() {
        let line = "focus-loop https://example.com/loop.mp3 --start 1.5 --duration 60.0 --pitch 2.0 --gain -3.0";
        let spec = parse_asset_line(line).expect("parse");
        assert_eq!(spec.name, "focus-loop");
        assert_eq!(spec.trim_start_seconds, Some(1.5));
        assert_eq!(spec.trim_duration_seconds, Some(60.0));
        assert_eq!(spec.pitch_semitones, Some(2.0));
        assert_eq!(spec.gain_db, Some(-3.0));
    }

    #[test]
    fn test_parse_asset_line_invalid_url() {
        let line = "bad-sound not-a-url";
        assert!(parse_asset_line(line).is_err());
    }

    #[test]
    fn test_parse_asset_line_missing_value() {
        let line = "sound https://example.com/s.mp3 --start";
        assert!(parse_asset_line(line).is_err());
    }

    #[test]
    fn test_parse_sound_sources_ignores_comments_and_headers() {
        let content = r#"
# Sound Effects

| ID | URL |
|----|-----|

session-start-chime https://example.com/chime.mp3
focus-loop https://example.com/loop.mp3

## Notes
This is a note.
"#;
        let specs = parse_sound_sources(content).expect("parse all");
        assert_eq!(specs.len(), 2);
        assert_eq!(specs[0].name, "session-start-chime");
        assert_eq!(specs[1].name, "focus-loop");
    }

    #[test]
    fn test_ffmpeg_command_minimal() {
        let asset = AssetSpec {
            name: "test".to_string(),
            url: "https://example.com/test.mp3".to_string(),
            trim_start_seconds: None,
            trim_duration_seconds: None,
            pitch_semitones: None,
            gain_db: None,
        };
        let cmd = ffmpeg_command(&asset, Path::new("in.mp3"), Path::new("out.m4a"));
        assert_eq!(cmd[0], "ffmpeg");
        assert!(cmd.contains(&"in.mp3".to_string()));
        assert!(cmd.contains(&"out.m4a".to_string()));
    }

    #[test]
    fn test_ffmpeg_command_with_trim_and_gain() {
        let asset = AssetSpec {
            name: "test".to_string(),
            url: "https://example.com/test.mp3".to_string(),
            trim_start_seconds: Some(1.5),
            trim_duration_seconds: Some(5.0),
            pitch_semitones: None,
            gain_db: Some(-3.0),
        };
        let cmd = ffmpeg_command(&asset, Path::new("in.mp3"), Path::new("out.m4a"));
        assert!(cmd.iter().any(|s| s.contains("atrim")));
        assert!(cmd.iter().any(|s| s.contains("-3")));
    }

    #[test]
    fn test_cache_hit_no_cache() {
        let cache_dir = tempfile::tempdir().expect("temp dir");
        let asset = AssetSpec {
            name: "test".to_string(),
            url: "https://example.com/test.mp3".to_string(),
            trim_start_seconds: None,
            trim_duration_seconds: None,
            pitch_semitones: None,
            gain_db: None,
        };
        let hit = cache_hit(cache_dir.path(), &asset).expect("cache check");
        assert!(hit.is_none());
    }

    #[test]
    fn test_parse_asset_line_empty() {
        assert!(parse_asset_line("").is_err());
    }

    #[test]
    fn test_parse_asset_line_comment() {
        assert!(parse_asset_line("# this is a comment").is_err());
    }
}
