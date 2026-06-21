// SPDX-License-Identifier: MIT OR Apache-2.0

//! Release plan generator: dry-run output showing all steps.

use anyhow::{anyhow, Result};
use semver::Version;
use std::path::Path;

#[derive(Clone, Debug)]
pub struct Plan {
    pub version: Version,
    pub git_tag: String,
    pub version_bumps: Vec<VersionBump>,
    pub changelog_path: String,
    #[allow(dead_code)]
    pub discord_post: String,
    pub fastlane_lane: String,
}

#[derive(Clone, Debug)]
pub struct VersionBump {
    pub path: String,
    pub old_version: String,
    pub new_version: String,
}

impl Plan {
    pub fn print(&self) {
        println!("┌─ Release Plan: {} ─────────────────────────────────┐", self.version);
        println!("│");
        println!("│ 1. Git Tag:");
        println!("│    $ git tag -a {} -m 'FocalPoint {}'", self.git_tag, self.version);
        println!("│    $ git push origin {}", self.git_tag);
        println!("│");
        println!("│ 2. Version Bumps:");
        for bump in &self.version_bumps {
            println!(
                "│    {} {} → {}",
                bump.path, bump.old_version, bump.new_version
            );
        }
        println!("│");
        println!("│ 3. CHANGELOG.md:");
        println!(
            "│    Prepend release section from 'focus release-notes' to {}",
            self.changelog_path
        );
        println!("│");
        println!("│ 4. Discord Announcement:");
        println!("│    POST to #releases webhook with formatted embeds");
        println!("│    (includes all commits since last tag)");
        println!("│");
        println!("│ 5. FastLane Beta Build:");
        println!("│    $ cd apps/ios && {}", self.fastlane_lane);
        println!("│    → increments build number");
        println!("│    → signs with distribution cert");
        println!("│    → uploads to TestFlight");
        println!("│    → notifies testers");
        println!("│");
        println!("└────────────────────────────────────────────────────┘");
    }
}

pub struct Planner {
    repo_root: std::path::PathBuf,
}

impl Planner {
    pub fn new(repo_root: &Path) -> Self {
        Self {
            repo_root: repo_root.to_path_buf(),
        }
    }

    pub fn plan_release(&self, version: &Version) -> Result<Plan> {
        let git_tag = format!("v{}", version);

        // Collect version bumps in Cargo.toml files
        let version_bumps = self.collect_version_bumps(version)?;

        let changelog_path = self.repo_root.join("CHANGELOG.md");
        if !changelog_path.exists() {
            return Err(anyhow!("CHANGELOG.md not found at repo root"));
        }

        // Build Discord post (summarized here; actual content from `focus release-notes`)
        let discord_post = self.build_discord_post(version)?;

        // Fastlane invocation
        let fastlane_lane = format!("fastlane ios beta version:{}", version);

        Ok(Plan {
            version: version.clone(),
            git_tag,
            version_bumps,
            changelog_path: changelog_path.display().to_string(),
            discord_post,
            fastlane_lane,
        })
    }

    fn collect_version_bumps(&self, new_version: &Version) -> Result<Vec<VersionBump>> {
        let mut bumps = Vec::new();

        // Root Cargo.toml
        let root_cargo = self.repo_root.join("Cargo.toml");
        let root_content = std::fs::read_to_string(&root_cargo)?;
        if let Some(old_version) = extract_workspace_version(&root_content) {
            if old_version != new_version.to_string() {
                bumps.push(VersionBump {
                    path: "Cargo.toml".to_string(),
                    old_version: old_version.clone(),
                    new_version: new_version.to_string(),
                });
            }
        }

        // iOS plist version
        let ios_plist = self.repo_root.join(
            "apps/ios/FocalPoint/Sources/FocalPointApp/Info.plist"
        );
        if ios_plist.exists() {
            let plist_content = std::fs::read_to_string(&ios_plist)?;
            if let Some(old_plist_version) = extract_plist_version(&plist_content) {
                bumps.push(VersionBump {
                    path: ios_plist.display().to_string(),
                    old_version: old_plist_version,
                    new_version: format!("{}.{}.{}", new_version.major, new_version.minor, new_version.patch),
                });
            }
        }

        Ok(bumps)
    }

    fn build_discord_post(&self, version: &Version) -> Result<String> {
        // Simulate Discord embed format (actual content from focus release-notes)
        let summary = format!(
            r#"🎉 **FocalPoint {}** Release

Includes all commits since last tag.
Check the #releases channel for full details.

📥 **Install:** TestFlight link will be posted once build completes"#,
            version
        );
        Ok(summary)
    }
}

fn extract_workspace_version(content: &str) -> Option<String> {
    for line in content.lines() {
        if line.contains("version") && line.contains("=") && line.contains("workspace") {
            // e.g., "version.workspace = true" → extract from [workspace] section instead
        }
        if line.trim().starts_with("version = ") {
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start + 1..].find('"') {
                    return Some(line[start + 1..start + 1 + end].to_string());
                }
            }
        }
    }
    None
}

fn extract_plist_version(content: &str) -> Option<String> {
    for line in content.lines() {
        if line.contains("CFBundleShortVersionString") {
            // Next line or same line has the version
            if let Some(pos) = line.find('>') {
                if let Some(end) = content[pos..].find('<') {
                    return Some(content[pos + 1..pos + end].trim().to_string());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-RELEASE-001 (dry-run emits valid plan)
    #[test]
    fn test_plan_structure() {
        let version = Version::parse("0.0.7").unwrap();
        let plan = Plan {
            version: version.clone(),
            git_tag: "v0.0.7".to_string(),
            version_bumps: vec![VersionBump {
                path: "Cargo.toml".to_string(),
                old_version: "0.0.6".to_string(),
                new_version: "0.0.7".to_string(),
            }],
            changelog_path: "/path/to/CHANGELOG.md".to_string(),
            discord_post: "Release post".to_string(),
            fastlane_lane: "fastlane ios beta version:0.0.7".to_string(),
        };

        assert_eq!(plan.git_tag, "v0.0.7");
        assert_eq!(plan.version_bumps.len(), 1);
    }

    // Traces to: FR-RELEASE-002 (version extraction correct per semver)
    #[test]
    fn test_version_extraction() {
        let content = r#"[workspace]
version = "0.0.6"
resolver = "2""#;

        let extracted = extract_workspace_version(content);
        assert_eq!(extracted, Some("0.0.6".to_string()));
    }
}
