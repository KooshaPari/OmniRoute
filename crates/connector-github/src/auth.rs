// SPDX-License-Identifier: MIT OR Apache-2.0

//! GitHub Personal Access Token (PAT) storage.
//!
//! GitHub PATs don't refresh — they're issued out-of-band by the user and
//! either don't expire or expire at a user-chosen time. We just hold onto
//! the secret until GitHub rejects it (401) or the user rotates it.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};

use focus_connectors::ConnectorError;

/// Persisted GitHub token material.
///
/// `access_token` is a `SecretString` so it can't accidentally leak into
/// `Debug` output. `captured_at` is when we received it from the user; it's
/// captured on the device and only used as a display / telemetry hint —
/// GitHub itself never tells us when a PAT was minted.
#[derive(Clone, Serialize, Deserialize)]
pub struct GitHubToken {
    /// Opaque PAT value. Never logged.
    #[serde(with = "secret_string_serde")]
    pub access_token: SecretString,
    /// Timestamp at which the user handed us the token.
    pub captured_at: DateTime<Utc>,
}

impl std::fmt::Debug for GitHubToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GitHubToken")
            .field("access_token", &"***redacted***")
            .field("captured_at", &self.captured_at)
            .finish()
    }
}

impl PartialEq for GitHubToken {
    fn eq(&self, other: &Self) -> bool {
        self.access_token.expose_secret() == other.access_token.expose_secret()
            && self.captured_at == other.captured_at
    }
}

impl GitHubToken {
    pub fn new(pat: impl Into<String>) -> Self {
        Self { access_token: SecretString::from(pat.into()), captured_at: Utc::now() }
    }
}

/// Serde helper for `SecretString` — serialises as a plain string.
mod secret_string_serde {
    use secrecy::{ExposeSecret, SecretString};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(v: &SecretString, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(v.expose_secret())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<SecretString, D::Error> {
        let raw = String::deserialize(d)?;
        Ok(SecretString::from(raw))
    }
}

/// Token storage abstraction. Mirrors Canvas's `TokenStore` so the ergonomic
/// surface is identical.
#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn load(&self) -> Result<Option<GitHubToken>, ConnectorError>;
    async fn save(&self, token: &GitHubToken) -> Result<(), ConnectorError>;
    async fn clear(&self) -> Result<(), ConnectorError>;
}

/// In-memory token store, primarily for tests.
#[derive(Default)]
pub struct InMemoryTokenStore {
    inner: std::sync::Mutex<Option<GitHubToken>>,
}

impl InMemoryTokenStore {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn with_token(token: GitHubToken) -> Self {
        Self { inner: std::sync::Mutex::new(Some(token)) }
    }
}

#[async_trait]
impl TokenStore for InMemoryTokenStore {
    async fn load(&self) -> Result<Option<GitHubToken>, ConnectorError> {
        Ok(self.inner.lock().unwrap().clone())
    }
    async fn save(&self, token: &GitHubToken) -> Result<(), ConnectorError> {
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
/// Matches Canvas's `KeychainStore` shape: a single `account` key inside a
/// `service` namespace, with the `GitHubToken` JSON-serialised.
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
    async fn load(&self) -> Result<Option<GitHubToken>, ConnectorError> {
        let maybe = self
            .inner
            .load(&self.account)
            .map_err(|e| ConnectorError::Auth(format!("keychain load: {e}")))?;
        let Some(secret) = maybe else {
            return Ok(None);
        };
        let token: GitHubToken = serde_json::from_str(secret.expose_secret())
            .map_err(|e| ConnectorError::Auth(format!("keychain deserialize: {e}")))?;
        Ok(Some(token))
    }

    async fn save(&self, token: &GitHubToken) -> Result<(), ConnectorError> {
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
