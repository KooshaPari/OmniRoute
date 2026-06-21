// SPDX-License-Identifier: MIT OR Apache-2.0

//! Readwise token auth — in-memory token storage trait and implementation.

use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Token storage contract for Readwise bearer tokens.
#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn get_token(&self) -> Option<String>;
    async fn set_token(&self, token: String);
}

/// In-memory token store (ephemeral).
pub struct InMemoryTokenStore {
    token: Arc<Mutex<Option<String>>>,
}

impl Default for InMemoryTokenStore {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryTokenStore {
    pub fn new() -> Self {
        Self {
            token: Arc::new(Mutex::new(None)),
        }
    }
}

#[async_trait]
impl TokenStore for InMemoryTokenStore {
    async fn get_token(&self) -> Option<String> {
        self.token.lock().await.clone()
    }

    async fn set_token(&self, token: String) {
        *self.token.lock().await = Some(token);
    }
}

/// Readwise token-based auth helper.
pub struct ReadwiseAuth {
    pub token: String,
}

impl ReadwiseAuth {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            token: token.into(),
        }
    }

    pub fn bearer_header(&self) -> String {
        format!("Bearer {}", self.token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-READWISE-AUTH-001
    #[tokio::test]
    async fn in_memory_token_store_set_get() {
        let store = InMemoryTokenStore::new();
        assert!(store.get_token().await.is_none());
        store.set_token("test-token".into()).await;
        assert_eq!(store.get_token().await, Some("test-token".into()));
    }

    // Traces to: FR-READWISE-AUTH-001
    #[test]
    fn readwise_auth_bearer_header() {
        let auth = ReadwiseAuth::new("my-token");
        assert_eq!(auth.bearer_header(), "Bearer my-token");
    }

    // Traces to: FR-READWISE-AUTH-002
    #[tokio::test]
    async fn token_store_empty_initial() {
        let store = InMemoryTokenStore::new();
        assert!(store.get_token().await.is_none());
    }

    // Traces to: FR-READWISE-AUTH-003
    #[tokio::test]
    async fn token_store_update_token() {
        let store = InMemoryTokenStore::new();
        store.set_token("token1".into()).await;
        assert_eq!(store.get_token().await, Some("token1".into()));
        store.set_token("token2".into()).await;
        assert_eq!(store.get_token().await, Some("token2".into()));
    }

    // Traces to: FR-READWISE-AUTH-004
    #[test]
    fn readwise_auth_bearer_format() {
        let auth = ReadwiseAuth::new("secret_token_123");
        let header = auth.bearer_header();
        assert!(header.starts_with("Bearer "));
        assert!(header.ends_with("secret_token_123"));
    }

    // Traces to: FR-READWISE-AUTH-005
    #[test]
    fn readwise_auth_special_chars() {
        let token_with_dash = ReadwiseAuth::new("token-with-dashes");
        let token_with_underscore = ReadwiseAuth::new("token_with_underscores");
        assert!(token_with_dash.bearer_header().contains("token-with-dashes"));
        assert!(token_with_underscore.bearer_header().contains("token_with_underscores"));
    }

    // Traces to: FR-READWISE-AUTH-006
    #[tokio::test]
    async fn token_store_sequential_updates() {
        let store = InMemoryTokenStore::new();
        for i in 0..5 {
            let token = format!("token{}", i);
            store.set_token(token.clone()).await;
            assert_eq!(store.get_token().await, Some(token));
        }
    }

    // Traces to: FR-READWISE-AUTH-007
    #[test]
    fn readwise_auth_numeric_token() {
        let numeric_token = "123456789";
        let auth = ReadwiseAuth::new(numeric_token);
        assert_eq!(auth.token, numeric_token);
        assert_eq!(auth.bearer_header(), format!("Bearer {}", numeric_token));
    }

    // Traces to: FR-READWISE-AUTH-008
    #[tokio::test]
    async fn token_store_shared_access() {
        let store = Arc::new(InMemoryTokenStore::new());
        store.set_token("initial".into()).await;

        let store_clone = Arc::clone(&store);
        let handle = tokio::spawn(async move {
            store_clone.set_token("updated".into()).await;
        });

        handle.await.unwrap();
        assert_eq!(store.get_token().await, Some("updated".into()));
    }
}
