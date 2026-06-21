// SPDX-License-Identifier: MIT OR Apache-2.0

//! Strava API response models — activities, athlete, PRs.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Athlete summary returned by Strava.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Athlete {
    pub id: u64,
    pub username: Option<String>,
    pub firstname: Option<String>,
    pub lastname: Option<String>,
    pub resource_state: Option<i32>,
}

/// Activity summary returned by Strava's recent activities endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: u64,
    pub name: String,
    pub sport_type: String,
    pub start_date: String,
    pub start_date_local: String,
    pub distance: f64,
    pub moving_time: u32,
    pub elapsed_time: u32,
    pub elevation_gain: f64,
    pub type_: Option<String>,
    pub average_speed: Option<f64>,
    pub max_speed: Option<f64>,
    pub total_elevation_gain: Option<f64>,
    pub has_kudos: Option<bool>,
    pub pr_count: Option<u32>,
    pub achievement_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ActivitySummary {
    pub total_activities: u32,
    pub total_distance: f64,
    pub total_elevation_gain: f64,
    pub recent_pr_count: u32,
}

impl Activity {
    /// Parse Strava API JSON response into Activity.
    pub fn from_strava_json(json: &Value) -> Self {
        Self {
            id: json.get("id").and_then(|v| v.as_u64()).unwrap_or(0),
            name: json
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            sport_type: json
                .get("sport_type")
                .and_then(|v| v.as_str())
                .unwrap_or("other")
                .to_string(),
            start_date: json
                .get("start_date")
                .and_then(|v| v.as_str())
                .unwrap_or("1970-01-01T00:00:00Z")
                .to_string(),
            start_date_local: json
                .get("start_date_local")
                .and_then(|v| v.as_str())
                .unwrap_or("1970-01-01T00:00:00")
                .to_string(),
            distance: json
                .get("distance")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0),
            moving_time: json
                .get("moving_time")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            elapsed_time: json
                .get("elapsed_time")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            elevation_gain: json
                .get("elevation_gain")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0),
            type_: json.get("type").and_then(|v| v.as_str()).map(|s| s.to_string()),
            average_speed: json.get("average_speed").and_then(|v| v.as_f64()),
            max_speed: json.get("max_speed").and_then(|v| v.as_f64()),
            total_elevation_gain: json.get("total_elevation_gain").and_then(|v| v.as_f64()),
            has_kudos: json.get("has_kudos").and_then(|v| v.as_bool()),
            pr_count: json.get("pr_count").and_then(|v| v.as_u64()).map(|v| v as u32),
            achievement_count: json
                .get("achievement_count")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-STRAVA-MODELS-001
    #[test]
    fn parse_activity_from_json() {
        let json = serde_json::json!({
            "id": 12345678,
            "name": "Evening Run",
            "sport_type": "Run",
            "start_date": "2026-04-23T19:30:00Z",
            "start_date_local": "2026-04-23T15:30:00",
            "distance": 5000.0,
            "moving_time": 1800,
            "elapsed_time": 1850,
            "elevation_gain": 50.0,
            "pr_count": 1,
            "achievement_count": 2,
        });

        let activity = Activity::from_strava_json(&json);
        assert_eq!(activity.name, "Evening Run");
        assert_eq!(activity.distance, 5000.0);
        assert_eq!(activity.pr_count, Some(1));
    }
}
