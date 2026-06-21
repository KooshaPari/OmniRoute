// SPDX-License-Identifier: MIT OR Apache-2.0

//! Notion token auth — integration token storage trait and implementation.

use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Token storage contract for Notion integration tokens.
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

/// Notion integration token auth helper.
pub struct NotionAuth {
    pub token: String,
}

impl NotionAuth {
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

    // Traces to: FR-NOTION-AUTH-001
    #[tokio::test]
    async fn in_memory_token_store_set_get() {
        let store = InMemoryTokenStore::new();
        assert!(store.get_token().await.is_none());
        store.set_token("test-token".into()).await;
        assert_eq!(store.get_token().await, Some("test-token".into()));
    }

    // Traces to: FR-NOTION-AUTH-001
    #[test]
    fn notion_auth_bearer_header() {
        let auth = NotionAuth::new("my-token");
        assert_eq!(auth.bearer_header(), "Bearer my-token");
    }

    // Traces to: FR-NOTION-AUTH-002
    #[tokio::test]
    async fn in_memory_token_store_initial_empty() {
        let store = InMemoryTokenStore::new();
        let token = store.get_token().await;
        assert!(token.is_none());
    }

    // Traces to: FR-NOTION-AUTH-003
    #[tokio::test]
    async fn in_memory_token_store_overwrite() {
        let store = InMemoryTokenStore::new();
        store.set_token("token1".into()).await;
        store.set_token("token2".into()).await;
        let token = store.get_token().await;
        assert_eq!(token, Some("token2".into()));
    }

    // Traces to: FR-NOTION-AUTH-004
    #[test]
    fn notion_auth_bearer_header_escaping() {
        let auth = NotionAuth::new("token-with-special_chars");
        let header = auth.bearer_header();
        assert!(header.starts_with("Bearer "));
        assert!(header.contains("token-with-special_chars"));
    }

    // Traces to: FR-NOTION-AUTH-005
    #[tokio::test]
    async fn token_store_multiple_sequences() {
        let store = InMemoryTokenStore::new();
        store.set_token("token1".into()).await;
        assert_eq!(store.get_token().await, Some("token1".into()));
        store.set_token("token2".into()).await;
        assert_eq!(store.get_token().await, Some("token2".into()));
        store.set_token("token3".into()).await;
        assert_eq!(store.get_token().await, Some("token3".into()));
    }

    // Traces to: FR-NOTION-AUTH-006
    #[test]
    fn notion_auth_empty_token() {
        let auth = NotionAuth::new("");
        assert_eq!(auth.bearer_header(), "Bearer ");
    }

    // Traces to: FR-NOTION-AUTH-007
    #[test]
    fn notion_auth_long_token() {
        let long_token = "x".repeat(256);
        let auth = NotionAuth::new(&long_token);
        let header = auth.bearer_header();
        assert_eq!(header.len(), 7 + 256); // "Bearer " = 7 chars
        assert!(header.contains(&long_token));
    }

    // Traces to: FR-NOTION-AUTH-008
    #[tokio::test]
    async fn token_store_concurrent_access() {
        let store = Arc::new(InMemoryTokenStore::new());
        store.set_token("initial".into()).await;

        let store_clone = Arc::clone(&store);
        let handle = tokio::spawn(async move {
            store_clone.set_token("from_task".into()).await;
        });

        handle.await.unwrap();
        assert_eq!(store.get_token().await, Some("from_task".into()));
    }
}
