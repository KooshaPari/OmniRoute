// SPDX-License-Identifier: MIT OR Apache-2.0

//! Fitbit REST API client — /1.2/user/-/sleep, /1/user/-/activities/recent, heart rate endpoints.

use chrono::Local;
use reqwest::Client;
use serde_json::Value;

use focus_connectors::Result as ConnResult;

use crate::models::{Activity, HeartRate, Sleep};

const FITBIT_API_BASE: &str = "https://api.fitbit.com";

/// Fitbit REST client — makes authenticated calls to Fitbit's Health API.
pub struct FitbitClient {
    http: Client,
}

impl FitbitClient {
    pub fn new(http: Client) -> Self {
        Self { http }
    }

    /// GET /1/user/-/profile — health check.
    pub async fn get_profile(&self) -> ConnResult<Value> {
        let url = format!("{}/1/user/-/profile.json", FITBIT_API_BASE);
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
                "Fitbit token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Fitbit profile request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /1/user/-/activities/date/today.json — today's activity summary.
    pub async fn get_activities_today(&self) -> ConnResult<Activity> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let url = format!(
            "{}/1/user/-/activities/date/{}.json",
            FITBIT_API_BASE, today
        );
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
            Ok(Activity::from_fitbit_json(&json))
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Fitbit token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Fitbit activities request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /1.2/user/-/sleep/date/today.json — today's sleep data.
    pub async fn get_sleep_today(&self) -> ConnResult<Sleep> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let url = format!("{}/1.2/user/-/sleep/date/{}.json", FITBIT_API_BASE, today);
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
            Ok(Sleep::from_fitbit_json(&json))
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Fitbit token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Fitbit sleep request failed: {}",
                resp.status()
            )))
        }
    }

    /// GET /1/user/-/activities/heart/date/today/1d.json — today's heart rate data.
    pub async fn get_heart_rate_today(&self) -> ConnResult<HeartRate> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let url = format!(
            "{}/1/user/-/activities/heart/date/{}/1d.json",
            FITBIT_API_BASE, today
        );
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
            Ok(HeartRate::from_fitbit_json(&json))
        } else if resp.status().as_u16() == 401 {
            Err(focus_connectors::ConnectorError::Unauthorized(
                "Fitbit token invalid or expired".into(),
            ))
        } else {
            Err(focus_connectors::ConnectorError::Network(format!(
                "Fitbit heart rate request failed: {}",
                resp.status()
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-CONNECTOR-001 (API client contract)
    #[tokio::test]
    async fn fitbit_client_construction() {
        let http = Client::new();
        let _client = FitbitClient::new(http);
        // Verify struct constructs without panicking
    }
}
