// SPDX-License-Identifier: MIT OR Apache-2.0

//! Linear token auth — PAT/OAuth2 token storage trait and implementation.

use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Token storage contract for Linear API tokens.
#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn get_token(&self) -> Option<String>;
    async fn set_token(&self, token: String);
}

/// In-memory token store (ephemeral).
#[derive(Default)]
pub struct InMemoryTokenStore {
    token: Arc<Mutex<Option<String>>>,
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

/// Linear token auth helper (supports PAT or OAuth2 access token).
pub struct LinearAuth {
    pub token: String,
}

impl LinearAuth {
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

    // Traces to: FR-LINEAR-AUTH-001
    #[tokio::test]
    async fn in_memory_token_store_set_get() {
        let store = InMemoryTokenStore::new();
        assert!(store.get_token().await.is_none());
        store.set_token("test-pat".into()).await;
        assert_eq!(store.get_token().await, Some("test-pat".into()));
    }

    // Traces to: FR-LINEAR-AUTH-001
    #[test]
    fn linear_auth_bearer_header() {
        let auth = LinearAuth::new("my-pat-token");
        assert_eq!(auth.bearer_header(), "Bearer my-pat-token");
    }

    // Traces to: FR-LINEAR-AUTH-002
    #[tokio::test]
    async fn token_store_initial_none() {
        let store = InMemoryTokenStore::new();
        assert!(store.get_token().await.is_none());
    }

    // Traces to: FR-LINEAR-AUTH-003
    #[tokio::test]
    async fn token_store_replace_token() {
        let store = InMemoryTokenStore::new();
        store.set_token("token1".into()).await;
        assert_eq!(store.get_token().await, Some("token1".into()));
        store.set_token("token2".into()).await;
        assert_eq!(store.get_token().await, Some("token2".into()));
    }

    // Traces to: FR-LINEAR-AUTH-004
    #[test]
    fn linear_auth_with_oauth_token() {
        let oauth_token = "oauth_token_abc123xyz";
        let auth = LinearAuth::new(oauth_token);
        let header = auth.bearer_header();
        assert!(header.starts_with("Bearer "));
        assert_eq!(auth.token, oauth_token);
    }

    // Traces to: FR-LINEAR-AUTH-005
    #[test]
    fn linear_auth_with_pat_token() {
        let pat_token = "lin_pat_1234567890abcdef";
        let auth = LinearAuth::new(pat_token);
        assert_eq!(auth.bearer_header(), format!("Bearer {}", pat_token));
    }

    // Traces to: FR-LINEAR-AUTH-006
    #[tokio::test]
    async fn token_store_multiple_keys_sequential() {
        let store = InMemoryTokenStore::new();
        store.set_token("key1".into()).await;
        assert_eq!(store.get_token().await, Some("key1".into()));
        store.set_token("key2".into()).await;
        assert_eq!(store.get_token().await, Some("key2".into()));
        store.set_token("key3".into()).await;
        assert_eq!(store.get_token().await, Some("key3".into()));
    }

    // Traces to: FR-LINEAR-AUTH-007
    #[test]
    fn linear_auth_long_token_string() {
        let long_token = "x".repeat(500);
        let auth = LinearAuth::new(&long_token);
        let header = auth.bearer_header();
        assert_eq!(header.len(), 7 + 500); // "Bearer " prefix + token
    }

    // Traces to: FR-LINEAR-AUTH-008
    #[tokio::test]
    async fn token_store_arc_clone() {
        let store = Arc::new(InMemoryTokenStore::new());
        store.set_token("shared_token".into()).await;

        let store_clone = Arc::clone(&store);
        let task = tokio::spawn(async move {
            store_clone.get_token().await
        });

        let result = task.await.unwrap();
        assert_eq!(result, Some("shared_token".into()));
    }
}
