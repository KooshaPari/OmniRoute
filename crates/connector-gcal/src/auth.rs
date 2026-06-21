// SPDX-License-Identifier: MIT OR Apache-2.0

//! Google Calendar OAuth2 implementation.
#![allow(clippy::disallowed_methods)]
//!
//! Google uses standard OAuth2 authorization code flow with endpoints:
//! - Authorize: `https://accounts.google.com/o/oauth2/v2/auth`
//! - Token:     `https://oauth2.googleapis.com/token`
//!
//! Scopes default to read-only calendar access (`calendar.readonly`). To get a
//! refresh token from Google, the authorize URL must include
//! `access_type=offline` and usually `prompt=consent` — these are injected
//! here so callers don't have to remember.

use std::sync::Mutex;

use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use oauth2::basic::BasicClient;
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, EndpointNotSet, EndpointSet,
    RedirectUrl, RefreshToken, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};

use focus_connectors::ConnectorError;

pub const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
pub const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
pub const CALENDAR_READONLY_SCOPE: &str = "https://www.googleapis.com/auth/calendar.readonly";

/// Configuration for Google Calendar OAuth2.
#[derive(Debug, Clone)]
pub struct GCalAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

/// Persisted access/refresh token material for Google Calendar.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GCalToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    /// When the access token was issued. Used as a heuristic for proactive
    /// refresh when `expires_at` is missing.
    #[serde(default = "Utc::now")]
    pub issued_at: DateTime<Utc>,
}

/// Google access tokens live 1 hour by default. If `expires_at` is missing
/// but a refresh token is present, treat the token as stale after this long.
pub const STALE_IF_NO_EXPIRY_SECS: i64 = 3600;

impl GCalToken {
    pub fn is_expired(&self) -> bool {
        self.is_expired_at(Utc::now())
    }

    pub fn is_expired_at(&self, now: DateTime<Utc>) -> bool {
        match self.expires_at {
            Some(exp) => now >= exp - Duration::seconds(30),
            None => {
                if self.refresh_token.is_some() {
                    now - self.issued_at >= Duration::seconds(STALE_IF_NO_EXPIRY_SECS)
                } else {
                    false
                }
            }
        }
    }
}

/// Token storage abstraction.
#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn load(&self) -> Result<Option<GCalToken>, ConnectorError>;
    async fn save(&self, token: &GCalToken) -> Result<(), ConnectorError>;
    async fn clear(&self) -> Result<(), ConnectorError>;
}

/// In-memory token store for tests and ephemeral sessions.
#[derive(Debug, Default)]
pub struct InMemoryTokenStore {
    inner: Mutex<Option<GCalToken>>,
}

impl InMemoryTokenStore {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn with_token(token: GCalToken) -> Self {
        Self { inner: Mutex::new(Some(token)) }
    }
}

#[async_trait]
impl TokenStore for InMemoryTokenStore {
    async fn load(&self) -> Result<Option<GCalToken>, ConnectorError> {
        Ok(self.inner.lock().unwrap().clone())
    }
    async fn save(&self, token: &GCalToken) -> Result<(), ConnectorError> {
        *self.inner.lock().unwrap() = Some(token.clone());
        Ok(())
    }
    async fn clear(&self) -> Result<(), ConnectorError> {
        *self.inner.lock().unwrap() = None;
        Ok(())
    }
}

/// [`TokenStore`] backed by any [`focus_crypto::SecureSecretStore`] impl.
///
/// Traces to: FR-DATA-002.
#[cfg(feature = "keychain")]
pub struct KeychainStore {
    account: String,
    inner: std::sync::Arc<dyn focus_crypto::SecureSecretStore>,
}

#[cfg(feature = "keychain")]
impl KeychainStore {
    pub fn new(
        account: impl Into<String>,
        inner: std::sync::Arc<dyn focus_crypto::SecureSecretStore>,
    ) -> Self {
        Self { account: account.into(), inner }
    }

    pub fn with_default_backend(service: &str, account: impl Into<String>) -> Self {
        let inner: std::sync::Arc<dyn focus_crypto::SecureSecretStore> =
            focus_crypto::default_secure_store(service).into();
        Self::new(account, inner)
    }
}

#[cfg(feature = "keychain")]
#[async_trait]
impl TokenStore for KeychainStore {
    async fn load(&self) -> Result<Option<GCalToken>, ConnectorError> {
        use secrecy::ExposeSecret;
        let maybe = self
            .inner
            .load(&self.account)
            .map_err(|e| ConnectorError::Auth(format!("keychain load: {e}")))?;
        let Some(secret) = maybe else {
            return Ok(None);
        };
        let token: GCalToken = serde_json::from_str(secret.expose_secret())
            .map_err(|e| ConnectorError::Auth(format!("keychain deserialize: {e}")))?;
        Ok(Some(token))
    }

    async fn save(&self, token: &GCalToken) -> Result<(), ConnectorError> {
        let json = serde_json::to_string(token)
            .map_err(|e| ConnectorError::Auth(format!("keychain serialize: {e}")))?;
        self.inner
            .store(&self.account, secrecy::SecretString::from(json))
            .map_err(|e| ConnectorError::Auth(format!("keychain store: {e}")))
    }

    async fn clear(&self) -> Result<(), ConnectorError> {
        self.inner
            .delete(&self.account)
            .map_err(|e| ConnectorError::Auth(format!("keychain delete: {e}")))
    }
}

type OAuthClient =
    BasicClient<EndpointSet, EndpointNotSet, EndpointNotSet, EndpointNotSet, EndpointSet>;

/// OAuth2 driver for Google Calendar.
pub struct GCalOAuth2 {
    config: GCalAuthConfig,
    client: OAuthClient,
    token_url_override: Option<String>,
    auth_url_override: Option<String>,
}

impl GCalOAuth2 {
    pub fn new(config: GCalAuthConfig) -> Result<Self, ConnectorError> {
        Self::with_endpoints(config, GOOGLE_AUTH_URL.into(), GOOGLE_TOKEN_URL.into())
    }

    /// Testing / staging entry point — overrides auth + token URLs (e.g. to
    /// point at a `wiremock` server).
    pub fn with_endpoints(
        config: GCalAuthConfig,
        auth_url: String,
        token_url: String,
    ) -> Result<Self, ConnectorError> {
        let auth = AuthUrl::new(auth_url.clone())
            .map_err(|e| ConnectorError::Auth(format!("bad auth url: {e}")))?;
        let token = TokenUrl::new(token_url.clone())
            .map_err(|e| ConnectorError::Auth(format!("bad token url: {e}")))?;
        let redirect = RedirectUrl::new(config.redirect_uri.clone())
            .map_err(|e| ConnectorError::Auth(format!("bad redirect url: {e}")))?;

        let client = BasicClient::new(ClientId::new(config.client_id.clone()))
            .set_client_secret(ClientSecret::new(config.client_secret.clone()))
            .set_auth_uri(auth)
            .set_token_uri(token)
            .set_redirect_uri(redirect);

        Ok(Self {
            config,
            client,
            token_url_override: if token_url == GOOGLE_TOKEN_URL { None } else { Some(token_url) },
            auth_url_override: if auth_url == GOOGLE_AUTH_URL { None } else { Some(auth_url) },
        })
    }

    pub fn config(&self) -> &GCalAuthConfig {
        &self.config
    }

    /// Build the authorization URL and CSRF token. `scopes` defaults to
    /// `calendar.readonly` when empty. Always injects `access_type=offline`
    /// and `prompt=consent` so Google actually returns a refresh token.
    pub fn authorize_url(&self, scopes: &[String]) -> (url::Url, CsrfToken) {
        let mut builder = self.client.authorize_url(CsrfToken::new_random);
        if scopes.is_empty() {
            builder = builder.add_scope(Scope::new(CALENDAR_READONLY_SCOPE.to_string()));
        } else {
            for s in scopes {
                builder = builder.add_scope(Scope::new(s.clone()));
            }
        }
        let (mut url, csrf) = builder.url();
        // `access_type=offline` + `prompt=consent` are Google-specific knobs
        // required to receive a refresh token on first auth and on re-consent.
        url.query_pairs_mut()
            .append_pair("access_type", "offline")
            .append_pair("prompt", "consent");
        (url, csrf)
    }

    /// Exchange an authorization code for tokens.
    pub async fn exchange_code(
        &self,
        code: String,
        http: &reqwest::Client,
    ) -> Result<GCalToken, ConnectorError> {
        let resp = self
            .client
            .exchange_code(AuthorizationCode::new(code))
            .request_async(http)
            .await
            .map_err(|e| ConnectorError::Auth(format!("code exchange: {e}")))?;
        Ok(to_token(&resp))
    }

    /// Refresh an access token. If Google omits `refresh_token` in the
    /// response (usual behavior), preserves the caller-supplied refresh token.
    pub async fn refresh(
        &self,
        refresh_token: &str,
        http: &reqwest::Client,
    ) -> Result<GCalToken, ConnectorError> {
        let resp = self
            .client
            .exchange_refresh_token(&RefreshToken::new(refresh_token.to_string()))
            .request_async(http)
            .await
            .map_err(|e| ConnectorError::Auth(format!("refresh: {e}")))?;
        let mut tok = to_token(&resp);
        if tok.refresh_token.is_none() {
            tok.refresh_token = Some(refresh_token.to_string());
        }
        Ok(tok)
    }

    #[doc(hidden)]
    pub fn token_url_override(&self) -> Option<&str> {
        self.token_url_override.as_deref()
    }

    #[doc(hidden)]
    pub fn auth_url_override(&self) -> Option<&str> {
        self.auth_url_override.as_deref()
    }
}

fn to_token(resp: &oauth2::basic::BasicTokenResponse) -> GCalToken {
    let now = Utc::now();
    let expires_at =
        resp.expires_in().and_then(|d| chrono::Duration::from_std(d).ok()).map(|d| now + d);
    GCalToken {
        access_token: resp.access_token().secret().clone(),
        refresh_token: resp.refresh_token().map(|r| r.secret().clone()),
        expires_at,
        issued_at: now,
    }
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn cfg() -> GCalAuthConfig {
        GCalAuthConfig {
            client_id: "cid".into(),
            client_secret: "csecret".into(),
            redirect_uri: "focalpoint://auth/gcal/callback".into(),
        }
    }

    #[test]
    fn builds_authorize_url_with_offline_and_default_scope() {
        let o = GCalOAuth2::new(cfg()).unwrap();
        let (url, _csrf) = o.authorize_url(&[]);
        let s = url.to_string();
        assert!(s.starts_with("https://accounts.google.com/o/oauth2/v2/auth"));
        assert!(s.contains("client_id=cid"));
        assert!(s.contains("response_type=code"));
        assert!(s.contains("access_type=offline"));
        assert!(s.contains("prompt=consent"));
        assert!(
            s.contains("calendar.readonly"),
            "default scope calendar.readonly must be present: {s}"
        );
    }

    #[test]
    fn authorize_url_accepts_custom_scopes() {
        let o = GCalOAuth2::new(cfg()).unwrap();
        let (url, _) = o.authorize_url(&["https://www.googleapis.com/auth/calendar".into()]);
        let s = url.to_string();
        assert!(s.contains("auth%2Fcalendar") || s.contains("auth/calendar"));
        assert!(!s.contains("calendar.readonly"));
    }

    #[tokio::test]
    async fn exchanges_code_against_mock() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "AAA",
                "refresh_token": "RRR",
                "token_type": "Bearer",
                "expires_in": 3600
            })))
            .mount(&server)
            .await;
        let o = GCalOAuth2::with_endpoints(
            cfg(),
            format!("{}/auth", server.uri()),
            format!("{}/token", server.uri()),
        )
        .unwrap();
        let http = reqwest::Client::new();
        let tok = o.exchange_code("thecode".into(), &http).await.unwrap();
        assert_eq!(tok.access_token, "AAA");
        assert_eq!(tok.refresh_token.as_deref(), Some("RRR"));
        assert!(tok.expires_at.is_some());
    }

    #[tokio::test]
    async fn refresh_preserves_refresh_token_when_google_omits_it() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "BBB",
                "token_type": "Bearer",
                "expires_in": 3600
            })))
            .mount(&server)
            .await;
        let o = GCalOAuth2::with_endpoints(
            cfg(),
            format!("{}/auth", server.uri()),
            format!("{}/token", server.uri()),
        )
        .unwrap();
        let http = reqwest::Client::new();
        let tok = o.refresh("old-refresh", &http).await.unwrap();
        assert_eq!(tok.access_token, "BBB");
        assert_eq!(tok.refresh_token.as_deref(), Some("old-refresh"));
    }

    #[tokio::test]
    async fn in_memory_token_store_roundtrip() {
        let store = InMemoryTokenStore::new();
        assert!(store.load().await.unwrap().is_none());
        let t = GCalToken {
            access_token: "x".into(),
            refresh_token: Some("r".into()),
            expires_at: None,
            issued_at: Utc::now(),
        };
        store.save(&t).await.unwrap();
        assert_eq!(store.load().await.unwrap().unwrap(), t);
        store.clear().await.unwrap();
        assert!(store.load().await.unwrap().is_none());
    }

    #[test]
    fn token_is_expired_respects_skew() {
        let now = Utc::now();
        let close = GCalToken {
            access_token: "x".into(),
            refresh_token: None,
            expires_at: Some(now + Duration::seconds(10)),
            issued_at: now,
        };
        assert!(close.is_expired_at(now));
        let plenty = GCalToken {
            access_token: "x".into(),
            refresh_token: None,
            expires_at: Some(now + Duration::seconds(120)),
            issued_at: now,
        };
        assert!(!plenty.is_expired_at(now));
    }

    #[test]
    fn token_without_expiry_becomes_stale_after_one_hour_if_refreshable() {
        let now = Utc::now();
        let refreshable = GCalToken {
            access_token: "x".into(),
            refresh_token: Some("r".into()),
            expires_at: None,
            issued_at: now - Duration::hours(2),
        };
        assert!(refreshable.is_expired_at(now));
        let no_refresh = GCalToken {
            access_token: "x".into(),
            refresh_token: None,
            expires_at: None,
            issued_at: now - Duration::hours(5),
        };
        assert!(!no_refresh.is_expired_at(now));
    }

    #[test]
    fn token_legacy_json_without_issued_at_deserializes() {
        let j = r#"{"access_token":"x","refresh_token":null,"expires_at":null}"#;
        let t: GCalToken = serde_json::from_str(j).unwrap();
        assert_eq!(t.access_token, "x");
        assert!(Utc::now() - t.issued_at < Duration::seconds(5));
    }

    #[test]
    fn token_json_roundtrip() {
        let t = GCalToken {
            access_token: "a".into(),
            refresh_token: Some("r".into()),
            expires_at: Some(Utc::now()),
            issued_at: Utc::now(),
        };
        let s = serde_json::to_string(&t).unwrap();
        let back: GCalToken = serde_json::from_str(&s).unwrap();
        assert_eq!(back.access_token, t.access_token);
        assert_eq!(back.refresh_token, t.refresh_token);
    }

    #[cfg(feature = "keychain")]
    #[tokio::test]
    async fn keychain_store_roundtrips_via_in_memory_secret_store() {
        use std::sync::Arc;
        let inner: Arc<dyn focus_crypto::SecureSecretStore> =
            Arc::new(focus_crypto::InMemorySecretStore::new());
        let store = KeychainStore::new("gcal:test@example.com", inner);
        assert!(store.load().await.unwrap().is_none());
        let t = GCalToken {
            access_token: "acc".into(),
            refresh_token: Some("ref".into()),
            expires_at: None,
            issued_at: Utc::now(),
        };
        store.save(&t).await.unwrap();
        assert_eq!(store.load().await.unwrap().unwrap(), t);
        store.clear().await.unwrap();
        assert!(store.load().await.unwrap().is_none());
    }
}
