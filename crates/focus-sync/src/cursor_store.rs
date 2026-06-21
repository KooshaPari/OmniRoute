// SPDX-License-Identifier: MIT OR Apache-2.0

//! Persistent cursor storage port.
//!
//! [`CursorStore`] is the seam between the in-memory [`crate::SyncOrchestrator`]
//! and durable storage. The trait lives here (not in `focus-storage`) to
//! preserve the existing dep graph direction: `focus-storage → focus-sync`
//! (for the SQLite impl). Putting the trait in `focus-storage` would force
//! `focus-sync → focus-storage`, which collides with storage impls that
//! depend on sync-side types in the future.
//!
//! Traces to: FR-EVT-003.

use async_trait::async_trait;

/// Durable per-(connector, entity-type) cursor storage.
///
/// Implementations MUST be safe against concurrent `save`s for different
/// connector/entity pairs. `save` is semantically an upsert: the most recent
/// value wins.
#[async_trait]
pub trait CursorStore: Send + Sync {
    /// Return the stored cursor for `(connector_id, entity_type)`, or `None`
    /// if one has never been saved.
    async fn load(&self, connector_id: &str, entity_type: &str) -> anyhow::Result<Option<String>>;

    /// Upsert the cursor for `(connector_id, entity_type)`.
    async fn save(&self, connector_id: &str, entity_type: &str, cursor: &str)
        -> anyhow::Result<()>;
}

/// [`CursorStore`] that drops everything. Used in existing orchestrator tests
/// that don't care about durability.
#[derive(Debug, Default, Clone)]
pub struct NoopCursorStore;

impl NoopCursorStore {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl CursorStore for NoopCursorStore {
    async fn load(
        &self,
        _connector_id: &str,
        _entity_type: &str,
    ) -> anyhow::Result<Option<String>> {
        Ok(None)
    }
    async fn save(
        &self,
        _connector_id: &str,
        _entity_type: &str,
        _cursor: &str,
    ) -> anyhow::Result<()> {
        Ok(())
    }
}

/// Thread-safe in-memory [`CursorStore`] used for tests that DO want
/// round-trip behaviour (register → sync → save → reload in a fresh
/// orchestrator wired to the same store).
#[derive(Debug, Default, Clone)]
pub struct InMemoryCursorStore {
    inner: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<(String, String), String>>>,
}

impl InMemoryCursorStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl CursorStore for InMemoryCursorStore {
    async fn load(&self, connector_id: &str, entity_type: &str) -> anyhow::Result<Option<String>> {
        Ok(self
            .inner
            .lock()
            .map_err(|e| anyhow::anyhow!("poisoned: {e}"))?
            .get(&(connector_id.to_string(), entity_type.to_string()))
            .cloned())
    }

    async fn save(
        &self,
        connector_id: &str,
        entity_type: &str,
        cursor: &str,
    ) -> anyhow::Result<()> {
        self.inner
            .lock()
            .map_err(|e| anyhow::anyhow!("poisoned: {e}"))?
            .insert((connector_id.to_string(), entity_type.to_string()), cursor.to_string());
        Ok(())
    }
}

/// Canonical entity-type name used by [`crate::SyncOrchestrator`] when it
/// persists a connector's last cursor. Stored here (not hardcoded at call
/// sites) so the SQLite migration + debugging tools can reference it.
pub const EVENTS_ENTITY_TYPE: &str = "events";

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn noop_store_always_returns_none() {
        let s = NoopCursorStore::new();
        s.save("c", "events", "x").await.unwrap();
        assert_eq!(s.load("c", "events").await.unwrap(), None);
    }

    #[tokio::test]
    async fn in_memory_store_roundtrips() {
        let s = InMemoryCursorStore::new();
        assert_eq!(s.load("c", "events").await.unwrap(), None);
        s.save("c", "events", "cur1").await.unwrap();
        assert_eq!(s.load("c", "events").await.unwrap().as_deref(), Some("cur1"));
        s.save("c", "events", "cur2").await.unwrap();
        assert_eq!(s.load("c", "events").await.unwrap().as_deref(), Some("cur2"));
        // Different entity-type is isolated.
        assert_eq!(s.load("c", "tasks").await.unwrap(), None);
        // Different connector is isolated.
        assert_eq!(s.load("c2", "events").await.unwrap(), None);
    }
}
