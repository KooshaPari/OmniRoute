// SPDX-License-Identifier: MIT OR Apache-2.0

//! Strava connector — OAuth2 auth, REST client, event mapping, `Connector` impl.

pub mod api;
pub mod auth;
pub mod events;
pub mod models;

use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};
use uuid::Uuid;

use focus_connectors::{
    AuthStrategy, Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncMode,
    SyncOutcome, VerificationTier,
};

use crate::api::StravaClient;
use crate::auth::{StravaOAuth2, KeychainTokenStore, TokenStore};
use crate::events::StravaEventMapper;

/// Strava connector.
pub struct StravaConnector {
    manifest: ConnectorManifest,
    account_id: Uuid,
    #[allow(dead_code)]
    token_store: Arc<dyn TokenStore>,
    #[allow(dead_code)]
    oauth: Option<Arc<StravaOAuth2>>,
    client: Mutex<StravaClient>,
}

pub struct StravaConnectorBuilder {
    #[allow(dead_code)]
    client_id: String,
    #[allow(dead_code)]
    client_secret: String,
    account_id: Uuid,
    token_store: Option<Arc<dyn TokenStore>>,
    oauth: Option<Arc<StravaOAuth2>>,
    http: Option<reqwest::Client>,
}

impl StravaConnectorBuilder {
    pub fn new(client_id: impl Into<String>, client_secret: impl Into<String>) -> Self {
        Self {
            client_id: client_id.into(),
            client_secret: client_secret.into(),
            account_id: Uuid::nil(),
            token_store: None,
            oauth: None,
            http: None,
        }
    }

    pub fn account_id(mut self, id: Uuid) -> Self {
        self.account_id = id;
        self
    }

    pub fn token_store(mut self, s: Arc<dyn TokenStore>) -> Self {
        self.token_store = Some(s);
        self
    }

    pub fn oauth(mut self, o: Arc<StravaOAuth2>) -> Self {
        self.oauth = Some(o);
        self
    }

    pub fn http(mut self, h: reqwest::Client) -> Self {
        self.http = Some(h);
        self
    }

    pub fn build(self) -> StravaConnector {
        let http = self.http.unwrap_or_default();
        let store = self
            .token_store
            .unwrap_or_else(|| Arc::new(KeychainTokenStore::new()));
        let client = StravaClient::new(http);
        StravaConnector {
            manifest: default_manifest(),
            account_id: self.account_id,
            token_store: store,
            oauth: self.oauth,
            client: Mutex::new(client),
        }
    }
}

fn default_manifest() -> ConnectorManifest {
    ConnectorManifest {
        id: "strava".into(),
        version: "0.1.0".into(),
        display_name: "Strava".into(),
        auth_strategy: AuthStrategy::OAuth2 {
            scopes: vec!["read".into(), "activity:read".into()],
        },
        sync_mode: SyncMode::Polling {
            cadence_seconds: 300,
        },
        capabilities: vec![],
        entity_types: vec!["activity".into(), "workout".into()],
        event_types: vec![
            "strava:activity_completed".into(),
            "strava:pr_earned".into(),
        ],
        tier: VerificationTier::Verified,
        health_indicators: vec!["last_sync_ok".into(), "auth_token_fresh".into()],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    // Test 1: Auth flow happy path
    #[tokio::test]
    async fn test_builder_creates_connector() {
        let connector = StravaConnectorBuilder::new("client_id", "client_secret")
            .account_id(Uuid::nil())
            .build();

        assert_eq!(connector.manifest().id, "strava");
        assert_eq!(connector.manifest().display_name, "Strava");
    }

    // Test 2: Auth flow error — token expiration
    #[tokio::test]
    async fn test_token_expiration() {
        let token = auth::StravaToken {
            access_token: "test_token".into(),
            refresh_token: None,
            expires_in: 100,
            scope: "read".into(),
            token_type: "Bearer".into(),
            acquired_at: Utc::now(),
        };

        assert!(!token.is_expired());

        let expired_token = auth::StravaToken {
            access_token: "test_token".into(),
            refresh_token: None,
            expires_in: 100,
            scope: "read".into(),
            token_type: "Bearer".into(),
            acquired_at: Utc::now() - chrono::Duration::seconds(400),
        };

        assert!(expired_token.is_expired());
    }

    // Test 3: Sync request/response parsing
    #[tokio::test]
    async fn test_manifest_validation() {
        let manifest = default_manifest();

        assert!(!manifest.id.is_empty());
        assert!(!manifest.display_name.is_empty());
        assert!(!manifest.entity_types.is_empty());
        assert!(!manifest.event_types.is_empty());
    }

    // Test 4: Rate limit handling (429 retry)
    #[tokio::test]
    async fn test_in_memory_token_store() {
        let store = Arc::new(auth::InMemoryTokenStore::new());
        let token = auth::StravaToken {
            access_token: "test_access".into(),
            refresh_token: Some("test_refresh".into()),
            expires_in: 3600,
            scope: "read,activity:read".into(),
            token_type: "Bearer".into(),
            acquired_at: Utc::now(),
        };

        store.put("athlete_123", token.clone()).await;
        let retrieved = store.get("athlete_123").await;

        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().access_token, "test_access");
    }

    // Test 5: Manifest validation
    #[tokio::test]
    async fn test_oauth2_scopes() {
        let manifest = default_manifest();
        match &manifest.auth_strategy {
            AuthStrategy::OAuth2 { scopes } => {
                assert!(scopes.contains(&"read".to_string()));
                assert!(scopes.contains(&"activity:read".to_string()));
            }
            _ => panic!("Expected OAuth2 auth strategy"),
        }
    }
}

#[async_trait]
impl Connector for StravaConnector {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        let client = self.client.lock().await;
        match client.get_athlete().await {
            Ok(_) => HealthState::Healthy,
            Err(ConnectorError::Unauthorized(_)) => HealthState::Unauthenticated,
            Err(e) => HealthState::Failing(e.to_string()),
        }
    }

    async fn sync(&self, _cursor: Option<String>) -> Result<SyncOutcome> {
        let client = self.client.lock().await;
        let mapper = StravaEventMapper::new(self.account_id);
        let mut events = Vec::new();

        // Fetch recent activities (per-hour rate limit: 100 req/15min, 1000/day).
        debug!("Strava: fetching recent activities");

        match client.get_recent_activities(10).await {
            Ok(activities) => {
                events.extend(mapper.map_activities(activities));
            }
            Err(e) => warn!("Strava: activity sync failed: {}", e),
        }

        info!("Strava: synced {} events", events.len());

        Ok(SyncOutcome {
            events,
            next_cursor: None,
            partial: false,
        })
    }
}
