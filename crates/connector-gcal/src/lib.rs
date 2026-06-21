// SPDX-License-Identifier: MIT OR Apache-2.0

//! Google Calendar connector — OAuth2 auth, REST client, event mapping, `Connector` impl.

pub mod api;
pub mod auth;
pub mod events;
pub mod models;

use std::sync::Arc;

use async_trait::async_trait;
use chrono::{Duration, Utc};
use tokio::sync::Mutex;
use tracing::warn;
use uuid::Uuid;

use focus_connectors::{
    AuthStrategy, Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncMode,
    SyncOutcome, VerificationTier,
};

use crate::api::GCalClient;
use crate::auth::{GCalOAuth2, InMemoryTokenStore, TokenStore, CALENDAR_READONLY_SCOPE};
use crate::events::GCalEventMapper;

/// Defensive cap on per-calendar pagination to prevent runaway sync loops.
pub const MAX_PAGES_PER_CALENDAR: usize = 10;

/// Default lookahead window when sync is invoked with no explicit range.
pub const DEFAULT_LOOKAHEAD_DAYS: i64 = 14;
pub const DEFAULT_LOOKBEHIND_DAYS: i64 = 1;

/// Google Calendar connector.
pub struct GCalConnector {
    manifest: ConnectorManifest,
    account_id: Uuid,
    token_store: Arc<dyn TokenStore>,
    oauth: Option<Arc<GCalOAuth2>>,
    client: Mutex<GCalClient>,
}

pub struct GCalConnectorBuilder {
    base_url: String,
    account_id: Uuid,
    token_store: Option<Arc<dyn TokenStore>>,
    oauth: Option<Arc<GCalOAuth2>>,
    http: Option<reqwest::Client>,
    scopes: Option<Vec<String>>,
}

impl GCalConnectorBuilder {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            account_id: Uuid::nil(),
            token_store: None,
            oauth: None,
            http: None,
            scopes: None,
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

    pub fn oauth(mut self, o: Arc<GCalOAuth2>) -> Self {
        self.oauth = Some(o);
        self
    }

    pub fn http(mut self, h: reqwest::Client) -> Self {
        self.http = Some(h);
        self
    }

    /// Override OAuth scopes. Default is `[calendar.readonly]`.
    pub fn scopes(mut self, scopes: Vec<String>) -> Self {
        self.scopes = Some(scopes);
        self
    }

    pub fn build(self) -> GCalConnector {
        let http = self.http.unwrap_or_default();
        let store = self.token_store.unwrap_or_else(|| Arc::new(InMemoryTokenStore::new()));
        let client = GCalClient::with_http(&self.base_url, "", http);
        let scopes = self.scopes.unwrap_or_else(|| vec![CALENDAR_READONLY_SCOPE.into()]);
        GCalConnector {
            manifest: default_manifest(scopes),
            account_id: self.account_id,
            token_store: store,
            oauth: self.oauth,
            client: Mutex::new(client),
        }
    }
}

fn default_manifest(scopes: Vec<String>) -> ConnectorManifest {
    ConnectorManifest {
        id: "gcal".into(),
        version: "0.1.0".into(),
        display_name: "Google Calendar".into(),
        auth_strategy: AuthStrategy::OAuth2 { scopes },
        sync_mode: SyncMode::Polling { cadence_seconds: 900 },
        capabilities: vec![],
        entity_types: vec!["calendar".into(), "event".into()],
        event_types: vec![
            "event_started".into(),
            "event_ended".into(),
            "gcal:calendar_subscribed".into(),
        ],
        tier: VerificationTier::Official,
        health_indicators: vec!["oauth_token_valid".into(), "last_sync_ok".into()],
    }
}

impl GCalConnector {
    pub fn builder(base_url: impl Into<String>) -> GCalConnectorBuilder {
        GCalConnectorBuilder::new(base_url)
    }

    /// Load token from store and push into the HTTP client.
    async fn refresh_client_token(&self) -> Result<()> {
        let tok = self
            .token_store
            .load()
            .await?
            .ok_or_else(|| ConnectorError::Auth("no token".into()))?;
        let mut c = self.client.lock().await;
        c.set_access_token(tok.access_token);
        Ok(())
    }

    /// Try a refresh via OAuth if we have the machinery.
    async fn try_token_refresh(&self) -> Result<()> {
        let oauth = self
            .oauth
            .as_ref()
            .ok_or_else(|| ConnectorError::Auth("no oauth configured".into()))?;
        let existing = self
            .token_store
            .load()
            .await?
            .ok_or_else(|| ConnectorError::Auth("no token to refresh".into()))?;
        let refresh = existing
            .refresh_token
            .clone()
            .ok_or_else(|| ConnectorError::Auth("no refresh token".into()))?;
        let http = reqwest::Client::new();
        let new = oauth.refresh(&refresh, &http).await?;
        self.token_store.save(&new).await?;
        self.refresh_client_token().await
    }
}

impl Default for GCalConnector {
    fn default() -> Self {
        GCalConnector::builder(crate::api::GOOGLE_API_BASE).build()
    }
}

/// Drain a `pageToken`-paginated listing up to [`MAX_PAGES_PER_CALENDAR`].
async fn drain_paginated<T, F, Fut>(
    label: &'static str,
    calendar_id: &str,
    mut fetch: F,
) -> std::result::Result<Vec<T>, ConnectorError>
where
    F: FnMut(Option<String>) -> Fut,
    Fut: std::future::Future<Output = std::result::Result<api::Page<T>, ConnectorError>>,
{
    let mut all = Vec::new();
    let mut cursor: Option<String> = None;
    for page_ix in 0..MAX_PAGES_PER_CALENDAR {
        let page = fetch(cursor.clone()).await?;
        all.extend(page.items);
        match page.next_cursor {
            Some(next) => cursor = Some(next),
            None => return Ok(all),
        }
        if page_ix + 1 == MAX_PAGES_PER_CALENDAR {
            warn!(
                target: "connector_gcal::sync",
                calendar_id,
                label,
                max_pages = MAX_PAGES_PER_CALENDAR,
                "hit per-calendar pagination cap; truncating"
            );
        }
    }
    Ok(all)
}

#[async_trait]
impl Connector for GCalConnector {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        if self.refresh_client_token().await.is_err() {
            return HealthState::Unauthenticated;
        }
        let client = self.client.lock().await.clone();
        match client.get_self().await {
            Ok(_) => HealthState::Healthy,
            Err(ConnectorError::Auth(_)) => HealthState::Unauthenticated,
            Err(e) => HealthState::Failing(e.to_string()),
        }
    }

    async fn sync(&self, cursor: Option<String>) -> Result<SyncOutcome> {
        self.refresh_client_token().await?;
        let client = { self.client.lock().await.clone() };

        let cal_page = match client.list_calendar_list(cursor.clone()).await {
            Ok(p) => p,
            Err(ConnectorError::Auth(_)) => {
                self.try_token_refresh().await?;
                let client = self.client.lock().await.clone();
                client.list_calendar_list(cursor).await?
            }
            Err(e) => return Err(e),
        };

        let now = Utc::now();
        let time_min = (now - Duration::days(DEFAULT_LOOKBEHIND_DAYS)).to_rfc3339();
        let time_max = (now + Duration::days(DEFAULT_LOOKAHEAD_DAYS)).to_rfc3339();

        let mut events = Vec::new();
        for cal in &cal_page.items {
            events.push(GCalEventMapper::map_calendar_subscribed(cal, self.account_id));

            let gcal_events = {
                let c = client.clone();
                let cal_id = cal.id.clone();
                let tmin = time_min.clone();
                let tmax = time_max.clone();
                let label_cal_id = cal.id.clone();
                drain_paginated("events", &label_cal_id, move |cur| {
                    let c = c.clone();
                    let cal_id = cal_id.clone();
                    let tmin = tmin.clone();
                    let tmax = tmax.clone();
                    async move { c.list_events(&cal_id, &tmin, &tmax, cur).await }
                })
                .await
            };
            let gcal_events = match gcal_events {
                Ok(v) => v,
                Err(e) => {
                    warn!(calendar_id = %cal.id, error = %e, "skipping calendar events");
                    continue;
                }
            };

            for e in &gcal_events {
                events.push(GCalEventMapper::map_event_started(e, self.account_id, &cal.id));
                if let Some(end_ev) = GCalEventMapper::map_event_ended(e, self.account_id, &cal.id)
                {
                    events.push(end_ev);
                }
            }
        }

        Ok(SyncOutcome { events, next_cursor: cal_page.next_cursor, partial: false })
    }
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;

    #[test]
    fn default_manifest_has_calendar_readonly_scope() {
        let m = default_manifest(vec![CALENDAR_READONLY_SCOPE.into()]);
        if let AuthStrategy::OAuth2 { scopes } = &m.auth_strategy {
            assert_eq!(scopes.len(), 1);
            assert_eq!(scopes[0], CALENDAR_READONLY_SCOPE);
        } else {
            panic!("expected OAuth2 strategy");
        }
    }

    #[test]
    fn builder_scopes_override_applies() {
        let conn = GCalConnector::builder("https://x")
            .scopes(vec!["https://www.googleapis.com/auth/calendar".into()])
            .build();
        if let AuthStrategy::OAuth2 { scopes } = &conn.manifest().auth_strategy {
            assert_eq!(scopes.len(), 1);
            assert!(scopes[0].ends_with("/calendar"));
        } else {
            panic!("expected OAuth2 strategy");
        }
    }

    #[test]
    fn manifest_declares_event_types() {
        let m = default_manifest(vec![]);
        for want in ["event_started", "event_ended", "gcal:calendar_subscribed"] {
            assert!(m.event_types.iter().any(|e| e == want), "missing event: {want}");
        }
    }

    #[test]
    fn manifest_entity_types_include_calendar_and_event() {
        let m = default_manifest(vec![]);
        assert!(m.entity_types.iter().any(|e| e == "calendar"));
        assert!(m.entity_types.iter().any(|e| e == "event"));
    }
}
