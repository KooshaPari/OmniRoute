// SPDX-License-Identifier: MIT OR Apache-2.0

#![allow(unused_imports)]
//! GitHub contributions connector — PAT auth, REST client, event mapping.
//!
//! The user provides a Personal Access Token (classic or fine-grained) via
//! the Settings UI. We validate the token by calling `GET /user`, persist it
//! in the OS keychain, and poll `GET /users/{login}/events` for recent
//! activity.
//!
//! PATs do not refresh — if GitHub returns 401 we surface `Unauthorized` and
//! the UI prompts the user to paste a new one.

pub mod api;
pub mod auth;
pub mod events;
pub mod models;
pub mod webhook;

use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::Mutex;
use uuid::Uuid;

use focus_connectors::{
    AuthStrategy, Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncMode,
    SyncOutcome, VerificationTier,
};

use crate::api::GitHubClient;
use crate::auth::{InMemoryTokenStore, TokenStore};
use crate::events::GitHubEventMapper;

/// GitHub connector.
pub struct GitHubConnector {
    manifest: ConnectorManifest,
    account_id: Uuid,
    token_store: Arc<dyn TokenStore>,
    base_url: String,
    http: reqwest::Client,
    /// The authenticated login (populated lazily on first successful sync /
    /// health check). Kept behind a mutex because the `Connector` trait uses
    /// shared references.
    login: Mutex<Option<String>>,
}

pub struct GitHubConnectorBuilder {
    base_url: String,
    account_id: Uuid,
    token_store: Option<Arc<dyn TokenStore>>,
    http: Option<reqwest::Client>,
}

impl GitHubConnectorBuilder {
    pub fn new() -> Self {
        Self {
            base_url: api::DEFAULT_BASE_URL.to_string(),
            account_id: Uuid::nil(),
            token_store: None,
            http: None,
        }
    }

    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self
    }

    pub fn account_id(mut self, id: Uuid) -> Self {
        self.account_id = id;
        self
    }

    pub fn token_store(mut self, s: Arc<dyn TokenStore>) -> Self {
        self.token_store = Some(s);
        self
    }

    pub fn http(mut self, h: reqwest::Client) -> Self {
        self.http = Some(h);
        self
    }

    pub fn build(self) -> GitHubConnector {
        let http = self.http.unwrap_or_default();
        let store = self.token_store.unwrap_or_else(|| Arc::new(InMemoryTokenStore::new()));
        GitHubConnector {
            manifest: default_manifest(),
            account_id: self.account_id,
            token_store: store,
            base_url: self.base_url,
            http,
            login: Mutex::new(None),
        }
    }
}

impl Default for GitHubConnectorBuilder {
    fn default() -> Self {
        Self::new()
    }
}

fn default_manifest() -> ConnectorManifest {
    ConnectorManifest {
        id: "github".into(),
        version: "0.1.0".into(),
        display_name: "GitHub".into(),
        // PAT is an opaque bearer — treat as ApiKey from the manifest's POV.
        auth_strategy: AuthStrategy::ApiKey,
        sync_mode: SyncMode::Polling { cadence_seconds: 900 },
        capabilities: vec![],
        entity_types: vec!["event".into()],
        event_types: vec![
            "github.push".into(),
            "github.pr.opened".into(),
            "github.pr.merged".into(),
            "github.pr.closed".into(),
            "github.issue.opened".into(),
            "github.issue.closed".into(),
            "github.issue.commented".into(),
            "github.create".into(),
        ],
        tier: VerificationTier::Official,
        health_indicators: vec!["pat_valid".into(), "last_sync_ok".into()],
    }
}

impl GitHubConnector {
    pub fn builder() -> GitHubConnectorBuilder {
        GitHubConnectorBuilder::new()
    }

    async fn make_client(&self) -> Result<GitHubClient> {
        let token = self
            .token_store
            .load()
            .await?
            .ok_or_else(|| ConnectorError::Unauthorized("no github token stored".into()))?;
        Ok(GitHubClient::with_http(&self.base_url, token, self.http.clone()))
    }

    async fn ensure_login(&self, client: &GitHubClient) -> Result<String> {
        {
            let g = self.login.lock().await;
            if let Some(l) = g.as_ref() {
                return Ok(l.clone());
            }
        }
        let user = client.get_self().await?;
        let mut g = self.login.lock().await;
        *g = Some(user.login.clone());
        Ok(user.login)
    }
}

impl Default for GitHubConnector {
    fn default() -> Self {
        GitHubConnectorBuilder::new().build()
    }
}

#[async_trait]
impl Connector for GitHubConnector {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        let client = match self.make_client().await {
            Ok(c) => c,
            Err(ConnectorError::Unauthorized(_)) => return HealthState::Unauthenticated,
            Err(e) => return HealthState::Failing(e.to_string()),
        };
        match client.get_self().await {
            Ok(_) => HealthState::Healthy,
            Err(ConnectorError::Unauthorized(_)) => HealthState::Unauthenticated,
            Err(e) => HealthState::Failing(e.to_string()),
        }
    }

    async fn sync(&self, cursor: Option<String>) -> Result<SyncOutcome> {
        let client = self.make_client().await?;
        let login = self.ensure_login(&client).await?;
        let page = client.list_user_events(&login, cursor).await?;
        let mut events = Vec::with_capacity(page.items.len());
        for raw in &page.items {
            if let Some(ne) = GitHubEventMapper::map(raw, self.account_id) {
                events.push(ne);
            }
        }
        let partial = page.next_cursor.is_some();
        Ok(SyncOutcome { events, next_cursor: page.next_cursor, partial })
    }
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use crate::auth::GitHubToken;
    use chrono::Utc;
    use secrecy::ExposeSecret;
    use serde_json::json;
    use wiremock::matchers::{header, method, path, path_regex};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[test]
    fn token_serde_roundtrip_preserves_secret() {
        let t = GitHubToken { access_token: "ghp_xxx".into(), captured_at: Utc::now() };
        let j = serde_json::to_string(&t).unwrap();
        assert!(j.contains("ghp_xxx"));
        let back: GitHubToken = serde_json::from_str(&j).unwrap();
        assert_eq!(back.access_token.expose_secret(), "ghp_xxx");
        assert_eq!(back.captured_at, t.captured_at);
    }

    #[test]
    fn token_debug_redacts_secret() {
        let t = GitHubToken { access_token: "ghp_supersecret".into(), captured_at: Utc::now() };
        let dbg = format!("{t:?}");
        assert!(!dbg.contains("ghp_supersecret"));
        assert!(dbg.contains("redacted"));
    }

    #[test]
    fn manifest_declares_contribution_event_types() {
        let m = default_manifest();
        for want in ["github.push", "github.pr.opened", "github.pr.merged", "github.issue.closed"] {
            assert!(m.event_types.iter().any(|e| e == want), "missing: {want}");
        }
        assert!(matches!(m.auth_strategy, AuthStrategy::ApiKey));
    }

    #[tokio::test]
    async fn sync_unauthorized_when_no_token() {
        let c = GitHubConnector::builder().base_url("http://unused.invalid").build();
        let err = c.sync(None).await.unwrap_err();
        assert!(matches!(err, ConnectorError::Unauthorized(_)));
    }

    #[tokio::test]
    async fn health_unauthenticated_on_401() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/user"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&server)
            .await;
        let store: Arc<dyn TokenStore> =
            Arc::new(InMemoryTokenStore::with_token(GitHubToken::new("bad")));
        let c = GitHubConnector::builder().base_url(server.uri()).token_store(store).build();
        assert!(matches!(c.health().await, HealthState::Unauthenticated));
    }

    #[tokio::test]
    async fn health_rate_limited_when_primary_quota_exhausted() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/user"))
            .and(header("user-agent", super::api::USER_AGENT_VALUE))
            .respond_with(
                ResponseTemplate::new(403)
                    .insert_header("X-RateLimit-Remaining", "0")
                    .insert_header("X-RateLimit-Reset", "1900000000")
                    .set_body_string("API rate limit exceeded"),
            )
            .mount(&server)
            .await;
        let store: Arc<dyn TokenStore> =
            Arc::new(InMemoryTokenStore::with_token(GitHubToken::new("ok")));
        let c = GitHubConnector::builder().base_url(server.uri()).token_store(store).build();
        match c.health().await {
            HealthState::Failing(msg) => {
                assert!(msg.contains("rate_limited_until"), "got: {msg}");
            }
            other => panic!("expected Failing(rate_limited_until), got {other:?}"),
        }
    }

    #[tokio::test]
    async fn sync_happy_path_maps_events_and_follows_pagination() {
        let server = MockServer::start().await;

        // /user → login
        Mock::given(method("GET"))
            .and(path("/user"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(json!({"id": 1, "login": "octocat"})),
            )
            .mount(&server)
            .await;

        let base = server.uri();
        let next_url = format!("{base}/users/octocat/events?page=2");
        let link = format!("<{next_url}>; rel=\"next\"");

        // page 2 (no next link) — one PR merged event. Registered first so
        // wiremock's "first-match" semantics prefer the more specific route.
        Mock::given(method("GET"))
            .and(path_regex(r"^/users/octocat/events$"))
            .and(wiremock::matchers::query_param("page", "2"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!([
                {
                    "id": "3",
                    "type": "PullRequestEvent",
                    "actor": {"id": 1, "login": "octocat"},
                    "repo": {"id": 12, "name": "octo/three"},
                    "public": true,
                    "created_at": "2026-04-01T12:02:00Z",
                    "payload": {"action": "closed", "pull_request": {"merged": true}}
                }
            ])))
            .mount(&server)
            .await;

        // page 1 with Link: rel="next" → page 2. Matches on `per_page` so it
        // doesn't accidentally swallow the page=2 request.
        Mock::given(method("GET"))
            .and(path_regex(r"^/users/octocat/events$"))
            .and(wiremock::matchers::query_param("per_page", "100"))
            .respond_with(
                ResponseTemplate::new(200).insert_header("Link", link.as_str()).set_body_json(
                    json!([
                        {
                            "id": "1",
                            "type": "PushEvent",
                            "actor": {"id": 1, "login": "octocat"},
                            "repo": {"id": 10, "name": "octo/one"},
                            "public": true,
                            "created_at": "2026-04-01T12:00:00Z",
                            "payload": {"size": 1}
                        },
                        {
                            "id": "2",
                            "type": "WatchEvent",
                            "actor": {"id": 1, "login": "octocat"},
                            "repo": {"id": 11, "name": "octo/two"},
                            "public": true,
                            "created_at": "2026-04-01T12:01:00Z",
                            "payload": {"action": "started"}
                        }
                    ]),
                ),
            )
            .mount(&server)
            .await;

        let store: Arc<dyn TokenStore> =
            Arc::new(InMemoryTokenStore::with_token(GitHubToken::new("pat")));
        let c = GitHubConnector::builder().base_url(server.uri()).token_store(store).build();
        let out = c.sync(None).await.unwrap();
        // 3 GitHub events in total; WatchEvent dropped → 2 mapped.
        assert_eq!(out.events.len(), 2);
        assert!(out.next_cursor.is_none());
        assert!(!out.partial);
    }
}
