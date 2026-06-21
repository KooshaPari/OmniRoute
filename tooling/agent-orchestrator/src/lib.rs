// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{anyhow, Result};
use glob::glob;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

pub mod disk_check;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lane {
    pub id: String,
    pub name: String,
    pub scope: Vec<String>,
    pub prompt_template: String,
    pub commit_message_prefix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationConfig {
    pub project_name: String,
    pub repo_root: String,
    pub sweep_cadence_minutes: u64,
    pub lanes: Vec<Lane>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaneTracker {
    pub lane_id: String,
    pub last_dispatch: Option<String>,
    pub in_flight: bool,
    pub last_commit_sha: Option<String>,
    pub coverage_count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackerState {
    pub timestamp: String,
    pub lanes: HashMap<String, LaneTracker>,
}

impl OrchestrationConfig {
    pub fn from_file(path: &PathBuf) -> Result<Self> {
        let content = fs::read_to_string(path)
            .map_err(|e| anyhow!("Failed to read orchestration.toml: {}", e))?;
        toml::from_str(&content)
            .map_err(|e| anyhow!("Failed to parse orchestration.toml: {}", e))
    }


    pub fn validate_non_overlapping(&self) -> Result<()> {
        let mut seen_files: HashMap<String, String> = HashMap::new();

        for lane in &self.lanes {
            for glob_pattern in &lane.scope {
                let expanded = glob(glob_pattern)
                    .map_err(|e| anyhow!("Invalid glob pattern '{}': {}", glob_pattern, e))?;

                for entry in expanded {
                    let path = entry.map_err(|e| anyhow!("Glob expansion error: {}", e))?;
                    let path_str = path
                        .to_string_lossy()
                        .to_string();

                    if let Some(existing_lane) = seen_files.get(&path_str) {
                        return Err(anyhow!(
                            "File '{}' is claimed by both lane '{}' and lane '{}'. Scopes must be non-overlapping.",
                            path_str, existing_lane, lane.id
                        ));
                    }
                    seen_files.insert(path_str, lane.id.clone());
                }
            }
        }

        Ok(())
    }

    pub fn get_lane_files(&self, lane_id: &str) -> Result<HashSet<String>> {
        let lane = self
            .lanes
            .iter()
            .find(|l| l.id == lane_id)
            .ok_or_else(|| anyhow!("Lane '{}' not found", lane_id))?;

        let mut files = HashSet::new();
        for glob_pattern in &lane.scope {
            let expanded = glob(glob_pattern)
                .map_err(|e| anyhow!("Invalid glob pattern '{}': {}", glob_pattern, e))?;

            for entry in expanded {
                let path = entry.map_err(|e| anyhow!("Glob expansion error: {}", e))?;
                files.insert(path.to_string_lossy().to_string());
            }
        }

        Ok(files)
    }
}

impl Default for TrackerState {
    fn default() -> Self {
        Self::new()
    }
}

impl TrackerState {
    pub fn new() -> Self {
        TrackerState {
            timestamp: chrono::Utc::now().to_rfc3339(),
            lanes: HashMap::new(),
        }
    }

    pub fn from_file(path: &PathBuf) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::new());
        }
        let content = fs::read_to_string(path)
            .map_err(|e| anyhow!("Failed to read tracker state: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| anyhow!("Failed to parse tracker state: {}", e))
    }

    #[allow(dead_code)]
    pub fn update_lane(&mut self, lane_id: String, in_flight: bool) {
        self.lanes.entry(lane_id.clone())
            .or_insert_with(|| LaneTracker {
                lane_id: lane_id.clone(),
                last_dispatch: None,
                in_flight: false,
                last_commit_sha: None,
                coverage_count: 0,
            })
            .in_flight = in_flight;
    }

    #[allow(dead_code)]
    pub fn mark_coverage_complete(&mut self, lane_id: &str) {
        if let Some(tracker) = self.lanes.get_mut(lane_id) {
            tracker.coverage_count += 1;
        }
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lane_parsing() {
        let config = OrchestrationConfig {
            project_name: "test".to_string(),
            repo_root: "/tmp".to_string(),
            sweep_cadence_minutes: 5,
            lanes: vec![
                Lane {
                    id: "lane1".to_string(),
                    name: "API Layer".to_string(),
                    scope: vec!["crates/focus-policy/**/*.rs".to_string()],
                    prompt_template: "Review policy crate".to_string(),
                    commit_message_prefix: "api".to_string(),
                },
                Lane {
                    id: "lane2".to_string(),
                    name: "Storage Layer".to_string(),
                    scope: vec!["crates/focus-storage/**/*.rs".to_string()],
                    prompt_template: "Review storage crate".to_string(),
                    commit_message_prefix: "storage".to_string(),
                },
            ],
        };

        assert_eq!(config.lanes.len(), 2);
        assert_eq!(config.lanes[0].id, "lane1");
        assert_eq!(config.lanes[1].id, "lane2");
    }

    #[test]
    fn test_non_overlap_detection() {
        // This test validates that the non-overlap detection logic is present.
        // In practice, if two lanes claim the same real files, validation fails.
        // Here we test the validation function doesn't crash on non-overlapping patterns.
        let config = OrchestrationConfig {
            project_name: "test".to_string(),
            repo_root: "/tmp".to_string(),
            sweep_cadence_minutes: 5,
            lanes: vec![
                Lane {
                    id: "lane1".to_string(),
                    name: "Lane 1".to_string(),
                    scope: vec!["crates/focus-policy/**/*.rs".to_string()],
                    prompt_template: "".to_string(),
                    commit_message_prefix: "lane1".to_string(),
                },
                Lane {
                    id: "lane2".to_string(),
                    name: "Lane 2".to_string(),
                    scope: vec!["crates/focus-storage/**/*.rs".to_string()],
                    prompt_template: "".to_string(),
                    commit_message_prefix: "lane2".to_string(),
                },
            ],
        };

        // This should succeed since patterns don't overlap
        let result = config.validate_non_overlapping();
        assert!(result.is_ok(), "Non-overlapping patterns should validate");
    }

    #[test]
    fn test_tracker_state_roundtrip() {
        let mut state = TrackerState::new();
        state.update_lane("lane1".to_string(), true);
        state.update_lane("lane2".to_string(), false);
        state.mark_coverage_complete("lane1");

        assert_eq!(state.lanes.len(), 2);
        assert!(state.lanes["lane1"].in_flight);
        assert!(!state.lanes["lane2"].in_flight);
        assert_eq!(state.lanes["lane1"].coverage_count, 1);
    }

    #[test]
    fn test_tracker_json_serialization() {
        let mut state = TrackerState::new();
        state.update_lane("lane1".to_string(), true);

        let json = serde_json::to_string(&state).expect("Should serialize");
        let deserialized: TrackerState =
            serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.lanes.len(), 1);
        assert!(deserialized.lanes["lane1"].in_flight);
    }
}
