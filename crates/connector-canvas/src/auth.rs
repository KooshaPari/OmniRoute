// SPDX-License-Identifier: MIT OR Apache-2.0

//! Canvas OAuth2 implementation.
#![allow(clippy::disallowed_methods)]
//!
//! Canvas uses standard OAuth2 authorization code flow with endpoints:
//! - Authorize: `{base_url}/login/oauth2/auth`
//! - Token:     `{base_url}/login/oauth2/token`

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

/// Configuration for Canvas OAuth2.
#[derive(Debug, Clone)]
pub struct CanvasAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    /// Base URL of the Canvas instance, e.g. `https://canvas.instructure.com`.
    pub base_url: String,
    pub redirect_uri: String,
}

/// Persisted access/refresh token material.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanvasToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    /// When the access token was issued. Used as a heuristic for proactive
    /// refresh when `expires_at` is missing (some Canvas instances omit
    /// `expires_in`). Defaults to [`Utc::now`] during deserialization of
    /// legacy blobs that lacked this field.
    #[serde(default = "Utc::now")]
    pub issued_at: DateTime<Utc>,
}

/// After this many seconds since `issued_at`, if `expires_at` is `None` but a
/// refresh token is present, treat the token as due for proactive refresh.
/// Canvas's default access-token lifetime is 1 hour.
pub const STALE_IF_NO_EXPIRY_SECS: i64 = 3600;

impl CanvasToken {
    pub fn is_expired(&self) -> bool {
        match self.expires_at {
            Some(exp) => Utc::now() >= exp - Duration::seconds(30),
            None => {
                // No server-provided expiry. If we have a refresh token and
                // the access token is older than the canvas-default 1h
                // lifetime, treat it as stale so callers refresh proactively
                // rather than waiting for a 401.
                if self.refresh_token.is_some() {
                    Utc::now() - self.issued_at >= Duration::seconds(STALE_IF_NO_EXPIRY_SECS)
                } else {
                    false
                }
            }
        }
    }
}

/// Token storage abstraction. Implementations may back to memory, keychain, etc.
#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn load(&self) -> Result<Option<CanvasToken>, ConnectorError>;
    async fn save(&self, token: &CanvasToken) -> Result<(), ConnectorError>;
    async fn clear(&self) -> Result<(), ConnectorError>;
}

/// In-memory token store, primarily for tests and ephemeral sessions.
#[derive(Debug, Default)]
pub struct InMemoryTokenStore {
    inner: Mutex<Option<CanvasToken>>,
}

impl InMemoryTokenStore {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn with_token(token: CanvasToken) -> Self {
        Self { inner: Mutex::new(Some(token)) }
    }
}

#[async_trait]
impl TokenStore for InMemoryTokenStore {
    async fn load(&self) -> Result<Option<CanvasToken>, ConnectorError> {
        Ok(self.inner.lock().unwrap().clone())
    }
    async fn save(&self, token: &CanvasToken) -> Result<(), ConnectorError> {
        *self.inner.lock().unwrap() = Some(token.clone());
        Ok(())
    }
    async fn clear(&self) -> Result<(), ConnectorError> {
        *self.inner.lock().unwrap() = None;
        Ok(())
    }
}

/// [`TokenStore`] backed by any [`focus_crypto::SecureSecretStore`] impl
/// (Apple keychain, Linux Secret Service, or an in-memory double for tests).
///
/// The Canvas token is serialized as JSON and stored under a single `account`
/// key in the underlying secret store's `service` namespace. This lets us
/// keep the `TokenStore` surface small (load/save/clear) while delegating
/// platform-specific storage to `focus-crypto`.
///
/// Traces to: FR-DATA-002.
#[cfg(feature = "keychain")]
pub struct KeychainStore {
    account: String,
    inner: std::sync::Arc<dyn focus_crypto::SecureSecretStore>,
}

#[cfg(feature = "keychain")]
impl KeychainStore {
    /// Construct from any [`focus_crypto::SecureSecretStore`]. The `account` is the key
    /// under which the serialized token is stored (e.g. `"canvas:<user>"`).
    pub fn new(
        account: impl Into<String>,
        inner: std::sync::Arc<dyn focus_crypto::SecureSecretStore>,
    ) -> Self {
        Self { account: account.into(), inner }
    }

    /// Convenience: build using [`focus_crypto::default_secure_store`] for
    /// the current build target.
    pub fn with_default_backend(service: &str, account: impl Into<String>) -> Self {
        let inner: std::sync::Arc<dyn focus_crypto::SecureSecretStore> =
            focus_crypto::default_secure_store(service).into();
        Self::new(account, inner)
    }
}

#[cfg(feature = "keychain")]
#[async_trait]
impl TokenStore for KeychainStore {
    async fn load(&self) -> Result<Option<CanvasToken>, ConnectorError> {
        use secrecy::ExposeSecret;
        let maybe = self
            .inner
            .load(&self.account)
            .map_err(|e| ConnectorError::Auth(format!("keychain load: {e}")))?;
        let Some(secret) = maybe else {
            return Ok(None);
        };
        let token: CanvasToken = serde_json::from_str(secret.expose_secret())
            .map_err(|e| ConnectorError::Auth(format!("keychain deserialize: {e}")))?;
        Ok(Some(token))
    }

    async fn save(&self, token: &CanvasToken) -> Result<(), ConnectorError> {
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

/// OAuth2 driver for Canvas.
pub struct CanvasOAuth2 {
    config: CanvasAuthConfig,
    client: OAuthClient,
}

impl CanvasOAuth2 {
    pub fn new(config: CanvasAuthConfig) -> Result<Self, ConnectorError> {
        let auth_url = AuthUrl::new(format!("{}/login/oauth2/auth", config.base_url))
            .map_err(|e| ConnectorError::Auth(format!("bad auth url: {e}")))?;
        let token_url = TokenUrl::new(format!("{}/login/oauth2/token", config.base_url))
            .map_err(|e| ConnectorError::Auth(format!("bad token url: {e}")))?;
        let redirect = RedirectUrl::new(config.redirect_uri.clone())
            .map_err(|e| ConnectorError::Auth(format!("bad redirect url: {e}")))?;

        let client = BasicClient::new(ClientId::new(config.client_id.clone()))
            .set_client_secret(ClientSecret::new(config.client_secret.clone()))
            .set_auth_uri(auth_url)
            .set_token_uri(token_url)
            .set_redirect_uri(redirect);

        Ok(Self { config, client })
    }

    pub fn config(&self) -> &CanvasAuthConfig {
        &self.config
    }

    /// Build the authorization URL and CSRF token.
    pub fn authorize_url(&self, scopes: &[String]) -> (url::Url, CsrfToken) {
        let mut builder = self.client.authorize_url(CsrfToken::new_random);
        for s in scopes {
            builder = builder.add_scope(Scope::new(s.clone()));
        }
        builder.url()
    }

    /// Exchange an authorization code for tokens.
    pub async fn exchange_code(
        &self,
        code: String,
        http: &reqwest::Client,
    ) -> Result<CanvasToken, ConnectorError> {
        let resp = self
            .client
            .exchange_code(AuthorizationCode::new(code))
            .request_async(http)
            .await
            .map_err(|e| ConnectorError::Auth(format!("code exchange: {e}")))?;

        Ok(to_token(&resp))
    }

    /// Refresh an access token.
    pub async fn refresh(
        &self,
        refresh_token: &str,
        http: &reqwest::Client,
    ) -> Result<CanvasToken, ConnectorError> {
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
}

fn to_token(resp: &oauth2::basic::BasicTokenResponse) -> CanvasToken {
    let now = Utc::now();
    let expires_at =
        resp.expires_in().and_then(|d| chrono::Duration::from_std(d).ok()).map(|d| now + d);
    CanvasToken {
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

    fn cfg(base: &str) -> CanvasAuthConfig {
        CanvasAuthConfig {
            client_id: "cid".into(),
            client_secret: "csecret".into(),
            base_url: base.into(),
            redirect_uri: "http://localhost/cb".into(),
        }
    }

    #[tokio::test]
    async fn builds_authorize_url() {
        let o = CanvasOAuth2::new(cfg("https://canvas.example.com")).unwrap();
        let (url, _csrf) = o.authorize_url(&["url:GET|/api/v1/courses".into()]);
        let s = url.to_string();
        assert!(s.starts_with("https://canvas.example.com/login/oauth2/auth"));
        assert!(s.contains("client_id=cid"));
        assert!(s.contains("response_type=code"));
        assert!(s.contains("scope="));
    }

    #[tokio::test]
    async fn exchanges_code_against_mock() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/login/oauth2/token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "AAA",
                "refresh_token": "RRR",
                "token_type": "Bearer",
                "expires_in": 3600
            })))
            .mount(&server)
            .await;

        let o = CanvasOAuth2::new(cfg(&server.uri())).unwrap();
        let http = reqwest::Client::new();
        let tok = o.exchange_code("thecode".into(), &http).await.unwrap();
        assert_eq!(tok.access_token, "AAA");
        assert_eq!(tok.refresh_token.as_deref(), Some("RRR"));
        assert!(tok.expires_at.is_some());
    }

    #[tokio::test]
    async fn refresh_preserves_refresh_token_when_missing() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/login/oauth2/token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "access_token": "BBB",
                "token_type": "Bearer",
                "expires_in": 3600
            })))
            .mount(&server)
            .await;

        let o = CanvasOAuth2::new(cfg(&server.uri())).unwrap();
        let http = reqwest::Client::new();
        let tok = o.refresh("old-refresh", &http).await.unwrap();
        assert_eq!(tok.access_token, "BBB");
        assert_eq!(tok.refresh_token.as_deref(), Some("old-refresh"));
    }

    #[tokio::test]
    async fn in_memory_token_store_roundtrip() {
        let store = InMemoryTokenStore::new();
        assert!(store.load().await.unwrap().is_none());
        let t = CanvasToken {
            access_token: "x".into(),
            refresh_token: None,
            expires_at: None,
            issued_at: Utc::now(),
        };
        store.save(&t).await.unwrap();
        assert_eq!(store.load().await.unwrap().unwrap(), t);
        store.clear().await.unwrap();
        assert!(store.load().await.unwrap().is_none());
    }

    // Traces to: FR-DATA-002
    #[cfg(feature = "keychain")]
    #[tokio::test]
    async fn keychain_store_roundtrips_via_in_memory_secret_store() {
        use std::sync::Arc;
        let inner: Arc<dyn focus_crypto::SecureSecretStore> =
            Arc::new(focus_crypto::InMemorySecretStore::new());
        let store = KeychainStore::new("canvas:test", inner);
        assert!(store.load().await.unwrap().is_none());
        let t = CanvasToken {
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

    // Traces to: FR-DATA-002
    #[cfg(feature = "keychain")]
    #[tokio::test]
    async fn keychain_store_surfaces_backend_errors_as_auth_errors() {
        use secrecy::SecretString;
        use std::sync::Arc;
        // A store whose `load` always fails — use NullSecureStore which is
        // exported for exactly this scenario (unsupported platforms / fault
        // injection).
        let inner: Arc<dyn focus_crypto::SecureSecretStore> =
            Arc::new(focus_crypto::NullSecureStore::new());
        let store = KeychainStore::new("canvas:test", inner);
        let err = store
            .save(&CanvasToken {
                access_token: "x".into(),
                refresh_token: None,
                expires_at: None,
                issued_at: Utc::now(),
            })
            .await
            .unwrap_err();
        match err {
            ConnectorError::Auth(msg) => {
                assert!(msg.contains("keychain store"), "got: {msg}");
            }
            other => panic!("expected Auth error, got {other:?}"),
        }
        // Silence unused-import warning when feature on.
        let _ = SecretString::from("unused");
    }

    #[test]
    fn token_is_expired_respects_skew() {
        let t = CanvasToken {
            access_token: "x".into(),
            refresh_token: None,
            expires_at: Some(Utc::now() + Duration::seconds(10)),
            issued_at: Utc::now(),
        };
        assert!(t.is_expired());
        let t2 = CanvasToken {
            access_token: "x".into(),
            refresh_token: None,
            expires_at: Some(Utc::now() + Duration::seconds(120)),
            issued_at: Utc::now(),
        };
        assert!(!t2.is_expired());
    }

    #[test]
    fn token_without_expiry_refreshes_after_one_hour_if_refresh_token_present() {
        // No expires_at, no refresh_token → never expired (can't refresh anyway).
        let no_refresh = CanvasToken {
            access_token: "x".into(),
            refresh_token: None,
            expires_at: None,
            issued_at: Utc::now() - Duration::hours(5),
        };
        assert!(!no_refresh.is_expired());

        // No expires_at, has refresh_token, issued <1h ago → fresh.
        let fresh = CanvasToken {
            access_token: "x".into(),
            refresh_token: Some("r".into()),
            expires_at: None,
            issued_at: Utc::now() - Duration::minutes(30),
        };
        assert!(!fresh.is_expired());

        // No expires_at, has refresh_token, issued >1h ago → stale.
        let stale = CanvasToken {
            access_token: "x".into(),
            refresh_token: Some("r".into()),
            expires_at: None,
            issued_at: Utc::now() - Duration::hours(2),
        };
        assert!(stale.is_expired());
    }

    #[test]
    fn token_legacy_json_without_issued_at_deserializes() {
        // Legacy blobs predating issued_at must still round-trip.
        let j = r#"{"access_token":"x","refresh_token":null,"expires_at":null}"#;
        let t: CanvasToken = serde_json::from_str(j).unwrap();
        assert_eq!(t.access_token, "x");
        // issued_at defaults to "now-ish", which is fine.
        assert!(Utc::now() - t.issued_at < Duration::seconds(5));
    }
}
