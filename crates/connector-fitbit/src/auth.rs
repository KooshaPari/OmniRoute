// SPDX-License-Identifier: MIT OR Apache-2.0

//! Fitbit OAuth2 authorization code flow, token storage (keychain-backed).

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// OAuth2 token returned by Fitbit's token endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FitbitToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub scope: String,
    pub token_type: String,
    pub acquired_at: DateTime<Utc>,
}

impl FitbitToken {
    pub fn is_expired(&self) -> bool {
        let now = Utc::now();
        let age = (now - self.acquired_at).num_seconds() as u64;
        age >= self.expires_in - 300 // 5 min buffer
    }
}

/// TokenStore trait — abstract over memory vs. keychain.
#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn get(&self, key: &str) -> Option<FitbitToken>;
    async fn put(&self, key: &str, token: FitbitToken);
    async fn delete(&self, key: &str);
}

/// In-memory token store (development/testing).
pub struct InMemoryTokenStore {
    tokens: Mutex<HashMap<String, FitbitToken>>,
}

impl InMemoryTokenStore {
    pub fn new() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for InMemoryTokenStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl TokenStore for InMemoryTokenStore {
    async fn get(&self, key: &str) -> Option<FitbitToken> {
        self.tokens.lock().await.get(key).cloned()
    }

    async fn put(&self, key: &str, token: FitbitToken) {
        self.tokens.lock().await.insert(key.to_string(), token);
    }

    async fn delete(&self, key: &str) {
        self.tokens.lock().await.remove(key);
    }
}

/// Keychain-backed token store (production iOS/macOS).
/// Note: iOS requires the keychain service to be wired up via FFI;
/// this is a stub that delegates to a mock impl for testing.
pub struct KeychainTokenStore;

impl KeychainTokenStore {
    pub fn new() -> Self {
        Self
    }
}

impl Default for KeychainTokenStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl TokenStore for KeychainTokenStore {
    async fn get(&self, _key: &str) -> Option<FitbitToken> {
        // TODO: Call into iOS keychain via FFI (crates/focus-ffi).
        // For now, always return None to trigger oauth flow.
        None
    }

    async fn put(&self, _key: &str, _token: FitbitToken) {
        // TODO: Call into iOS keychain via FFI.
    }

    async fn delete(&self, _key: &str) {
        // TODO: Call into iOS keychain via FFI.
    }
}

/// Fitbit OAuth2 flow manager.
pub struct FitbitOAuth2 {
    #[allow(dead_code)]
    client_id: String,
    #[allow(dead_code)]
    client_secret: String,
    #[allow(dead_code)]
    redirect_uri: String,
    http: reqwest::Client,
}

impl FitbitOAuth2 {
    pub fn new(
        client_id: impl Into<String>,
        client_secret: impl Into<String>,
        redirect_uri: impl Into<String>,
    ) -> Arc<Self> {
        Arc::new(Self {
            client_id: client_id.into(),
            client_secret: client_secret.into(),
            redirect_uri: redirect_uri.into(),
            http: reqwest::Client::new(),
        })
    }

    /// Build the authorization URL.
    pub fn auth_url(&self) -> String {
        format!(
            "https://www.fitbit.com/oauth2/authorize?client_id={}&response_type=code&scope=activity%20sleep%20heartrate&redirect_uri={}",
            self.client_id,
            urlencoding::encode(&self.redirect_uri)
        )
    }

    /// Exchange authorization code for access token.
    pub async fn exchange_code(&self, code: &str) -> Result<FitbitToken, String> {
        let params = [
            ("clientId", self.client_id.as_str()),
            ("code", code),
            ("grantType", "authorization_code"),
            ("redirect_uri", &self.redirect_uri),
        ];

        let resp = self
            .http
            .post("https://api.fitbit.com/oauth2/token")
            .form(&params)
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Token exchange failed: {}", resp.status()));
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            refresh_token: Option<String>,
            expires_in: u64,
            scope: String,
            token_type: String,
        }

        let token_resp: TokenResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        Ok(FitbitToken {
            access_token: token_resp.access_token,
            refresh_token: token_resp.refresh_token,
            expires_in: token_resp.expires_in,
            scope: token_resp.scope,
            token_type: token_resp.token_type,
            acquired_at: Utc::now(),
        })
    }

    /// Refresh an expired token.
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<FitbitToken, String> {
        let params = [
            ("grantType", "refresh_token"),
            ("refresh_token", refresh_token),
        ];

        let resp = self
            .http
            .post("https://api.fitbit.com/oauth2/token")
            .form(&params)
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Token refresh failed: {}", resp.status()));
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            refresh_token: Option<String>,
            expires_in: u64,
            scope: String,
            token_type: String,
        }

        let token_resp: TokenResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

        Ok(FitbitToken {
            access_token: token_resp.access_token,
            refresh_token: token_resp.refresh_token,
            expires_in: token_resp.expires_in,
            scope: token_resp.scope,
            token_type: token_resp.token_type,
            acquired_at: Utc::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-FITBIT-OAUTH-001
    #[test]
    fn token_expiration_check() {
        let token = FitbitToken {
            access_token: "test".into(),
            refresh_token: None,
            expires_in: 3600,
            scope: "activity".into(),
            token_type: "Bearer".into(),
            acquired_at: Utc::now(),
        };
        assert!(!token.is_expired());
    }

    // Traces to: FR-FITBIT-OAUTH-001
    #[tokio::test]
    async fn in_memory_token_store() {
        let store = InMemoryTokenStore::new();
        let token = FitbitToken {
            access_token: "test".into(),
            refresh_token: None,
            expires_in: 3600,
            scope: "activity".into(),
            token_type: "Bearer".into(),
            acquired_at: Utc::now(),
        };
        store.put("user123", token.clone()).await;
        let retrieved = store.get("user123").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().access_token, "test");
    }

    // Traces to: FR-FITBIT-OAUTH-001
    #[test]
    fn oauth2_auth_url() {
        let oauth = FitbitOAuth2::new("client_id", "secret", "http://localhost:8080/cb");
        let url = oauth.auth_url();
        assert!(url.contains("client_id=client_id"));
        assert!(url.contains("scope=activity"));
    }
}
