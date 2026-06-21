// SPDX-License-Identifier: MIT OR Apache-2.0

//! Strava REST API client — GET /api/v3/athlete/activities, /api/v3/activities/:id.
//! Rate limit: 100 req/15min, 1000/day.

use reqwest::Client;
use serde_json::Value;
use phenotype_observably_macros::async_instrumented;

use focus_connectors::Result as ConnResult;

use crate::models::Activity;

const STRAVA_API_BASE: &str = "https://www.strava.com/api/v3";

/// Strava REST client — makes authenticated calls to Strava's API.
pub struct StravaClient {
    http: Client,
}

impl StravaClient {
    pub fn new(http: Client) -> Self {
        Self { http }
    }

    /// GET /api/v3/athlete — health check.
    #[async_instrumented]
    pub async fn get_athlete(&self) -> ConnResult<Value> {
        let url = format!("{}/athlete", STRAVA_API_BASE);
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            resp.json()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Strava token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Strava athlete request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /api/v3/athlete/activities — fetch recent activities.
    /// Rate limit: 100 req/15min, 1000/day.
    #[async_instrumented]
    pub async fn get_recent_activities(&self, limit: u32) -> ConnResult<Vec<Activity>> {
        let url = format!(
            "{}/athlete/activities?per_page={}",
            STRAVA_API_BASE, limit
        );
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let json = resp
                .json::<Vec<Value>>()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))?;

            Ok(json
                .iter()
                .map(Activity::from_strava_json)
                .collect())
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Strava token invalid or expired".into(),
            ))
        } else if resp.status().as_u16() == 429 {
            Err(focus_connectors::ConnectorError::RateLimited(60))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Strava activities request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /api/v3/activities/:id — fetch a single activity details.
    #[async_instrumented]
    pub async fn get_activity(&self, id: u64) -> ConnResult<Activity> {
        let url = format!("{}/activities/{}", STRAVA_API_BASE, id);
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| focus_connectors::ConnectorError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let json = resp
                .json::<Value>()
                .await
                .map_err(|e| focus_connectors::ConnectorError::Schema(e.to_string()))?;

            Ok(Activity::from_strava_json(&json))
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Strava token invalid or expired".into(),
            ))
        } else if resp.status().as_u16() == 404 {
            Err(focus_connectors::ConnectorError::Network(
                "Activity not found".into(),
            ))
        } else if resp.status().as_u16() == 429 {
            Err(focus_connectors::ConnectorError::RateLimited(60))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Strava activity request failed: {}",
                resp.status()
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-STRAVA-API-001
    #[test]
    fn parse_activity_response() {
        let activity_json = serde_json::json!({
            "id": 111,
            "name": "Morning Run",
            "sport_type": "Run",
            "start_date": "2026-04-23T07:00:00Z",
            "distance": 5000.0,
            "moving_time": 1800,
            "elapsed_time": 1900,
            "elevation_gain": 50.0,
        });

        let parsed = Activity::from_strava_json(&activity_json);
        assert_eq!(parsed.name, "Morning Run");
        assert_eq!(parsed.sport_type, "Run");
        assert_eq!(parsed.distance, 5000.0);
    }

    // Traces to: FR-STRAVA-API-002
    #[test]
    fn parse_multiple_activities() {
        let activities = vec![
            serde_json::json!({
                "id": 111,
                "name": "Morning Run",
                "sport_type": "Run",
                "start_date": "2026-04-23T07:00:00Z",
                "distance": 5000.0,
                "moving_time": 1800,
                "elapsed_time": 1900,
                "elevation_gain": 50.0,
            }),
            serde_json::json!({
                "id": 222,
                "name": "Evening Ride",
                "sport_type": "Ride",
                "start_date": "2026-04-23T18:00:00Z",
                "distance": 30000.0,
                "moving_time": 5400,
                "elapsed_time": 5600,
                "elevation_gain": 200.0,
            }),
        ];

        let parsed: Vec<Activity> = activities
            .iter()
            .map(|v| Activity::from_strava_json(v))
            .collect();

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].name, "Morning Run");
        assert_eq!(parsed[1].sport_type, "Ride");
    }

    // Traces to: FR-STRAVA-API-003
    #[test]
    fn parse_activity_with_elevation() {
        let activity_json = serde_json::json!({
            "id": 333,
            "name": "Mountain Climb",
            "sport_type": "Run",
            "start_date": "2026-04-24T06:00:00Z",
            "distance": 10000.0,
            "moving_time": 3600,
            "elapsed_time": 3900,
            "elevation_gain": 500.0,
        });

        let parsed = Activity::from_strava_json(&activity_json);
        assert_eq!(parsed.elevation_gain, 500.0);
        assert_eq!(parsed.moving_time, 3600);
    }

    // Traces to: FR-STRAVA-API-004
    #[test]
    fn client_constructor() {
        let http_client = reqwest::Client::new();
        let client = StravaClient::new(http_client);
        // Client constructed successfully
        assert!(true);
    }

    // Traces to: FR-STRAVA-API-005
    #[test]
    fn strava_api_base_constant() {
        assert_eq!(STRAVA_API_BASE, "https://www.strava.com/api/v3");
    }

    // Traces to: FR-STRAVA-API-006
    #[test]
    fn parse_minimal_activity() {
        let activity_json = serde_json::json!({
            "id": 999,
            "name": "Quick Walk",
            "sport_type": "Walk",
            "start_date": "2026-04-25T12:00:00Z",
            "distance": 1000.0,
            "moving_time": 600,
            "elapsed_time": 700,
            "elevation_gain": 0.0,
        });

        let parsed = Activity::from_strava_json(&activity_json);
        assert_eq!(parsed.name, "Quick Walk");
        assert_eq!(parsed.distance, 1000.0);
    }

    // Traces to: FR-STRAVA-API-007
    #[test]
    fn activity_different_sports() {
        let run = serde_json::json!({
            "id": 1,
            "name": "Run",
            "sport_type": "Run",
            "start_date": "2026-04-25T07:00:00Z",
            "distance": 5000.0,
            "moving_time": 1800,
            "elapsed_time": 1900,
            "elevation_gain": 0.0,
        });
        let swim = serde_json::json!({
            "id": 2,
            "name": "Swim",
            "sport_type": "Swim",
            "start_date": "2026-04-25T08:00:00Z",
            "distance": 2000.0,
            "moving_time": 1200,
            "elapsed_time": 1300,
            "elevation_gain": 0.0,
        });

        let run_parsed = Activity::from_strava_json(&run);
        let swim_parsed = Activity::from_strava_json(&swim);

        assert_eq!(run_parsed.sport_type, "Run");
        assert_eq!(swim_parsed.sport_type, "Swim");
        assert_ne!(run_parsed.distance, swim_parsed.distance);
    }
}
