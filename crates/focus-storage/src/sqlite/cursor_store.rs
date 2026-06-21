// SPDX-License-Identifier: MIT OR Apache-2.0

//! SQLite-backed [`focus_sync::CursorStore`] impl.
//!
//! Traces to: FR-EVT-003, FR-DATA-001.

use anyhow::{Context, Result};
use async_trait::async_trait;
use focus_sync::CursorStore;
use rusqlite::{params, OptionalExtension};

use super::{rfc3339, SqliteAdapter};

#[async_trait]
impl CursorStore for SqliteAdapter {
    async fn load(&self, connector_id: &str, entity_type: &str) -> Result<Option<String>> {
        let conn = self.conn.clone();
        let connector_id = connector_id.to_string();
        let entity_type = entity_type.to_string();
        tokio::task::spawn_blocking(move || -> Result<Option<String>> {
            let guard = conn.blocking_lock();
            let row: Option<String> = guard
                .query_row(
                    "SELECT cursor FROM connector_cursors \
                     WHERE connector_id = ?1 AND entity_type = ?2",
                    params![connector_id, entity_type],
                    |r| r.get::<_, String>(0),
                )
                .optional()
                .context("select connector_cursors")?;
            Ok(row)
        })
        .await
        .context("join spawn_blocking")?
    }

    async fn save(&self, connector_id: &str, entity_type: &str, cursor: &str) -> Result<()> {
        let conn = self.conn.clone();
        let connector_id = connector_id.to_string();
        let entity_type = entity_type.to_string();
        let cursor = cursor.to_string();
        let now = rfc3339(chrono::Utc::now());
        tokio::task::spawn_blocking(move || -> Result<()> {
            let guard = conn.blocking_lock();
            guard
                .execute(
                    "INSERT INTO connector_cursors \
                       (connector_id, entity_type, cursor, updated_at) \
                     VALUES (?1, ?2, ?3, ?4) \
                     ON CONFLICT(connector_id, entity_type) DO UPDATE SET \
                       cursor = excluded.cursor, \
                       updated_at = excluded.updated_at",
                    params![connector_id, entity_type, cursor, now],
                )
                .context("upsert connector_cursors")?;
            Ok(())
        })
        .await
        .context("join spawn_blocking")?
    }
}

/// Concrete newtype alias for discoverability. The impl lives on
/// [`SqliteAdapter`] directly; `SqliteCursorStore` is a trivial re-export to
/// match the naming pattern of the other `_store.rs` modules and for callers
/// that prefer referring to the cursor port explicitly.
pub type SqliteCursorStore = SqliteAdapter;

#[cfg(test)]
mod tests {
    use super::*;

    async fn adapter() -> SqliteAdapter {
        SqliteAdapter::open_in_memory().expect("in-memory sqlite")
    }

    // Traces to: FR-EVT-003
    #[tokio::test]
    async fn missing_cursor_returns_none() {
        let a = adapter().await;
        assert_eq!(a.load("canvas", "events").await.unwrap(), None);
    }

    // Traces to: FR-EVT-003
    #[tokio::test]
    async fn save_then_load_roundtrips() {
        let a = adapter().await;
        a.save("canvas", "events", "cur-A").await.unwrap();
        assert_eq!(a.load("canvas", "events").await.unwrap().as_deref(), Some("cur-A"));
    }

    // Traces to: FR-EVT-003
    #[tokio::test]
    async fn save_overwrites_existing_cursor() {
        let a = adapter().await;
        a.save("canvas", "events", "cur-A").await.unwrap();
        a.save("canvas", "events", "cur-B").await.unwrap();
        assert_eq!(a.load("canvas", "events").await.unwrap().as_deref(), Some("cur-B"));
    }

    // Traces to: FR-EVT-003
    #[tokio::test]
    async fn connector_and_entity_type_are_isolated() {
        let a = adapter().await;
        a.save("canvas", "events", "C-E").await.unwrap();
        a.save("canvas", "tasks", "C-T").await.unwrap();
        a.save("google", "events", "G-E").await.unwrap();
        assert_eq!(a.load("canvas", "events").await.unwrap().as_deref(), Some("C-E"));
        assert_eq!(a.load("canvas", "tasks").await.unwrap().as_deref(), Some("C-T"));
        assert_eq!(a.load("google", "events").await.unwrap().as_deref(), Some("G-E"));
        assert_eq!(a.load("google", "tasks").await.unwrap(), None);
    }

    // Traces to: FR-EVT-003, FR-DATA-001
    #[tokio::test]
    async fn cursor_survives_reopen_via_same_file() {
        use std::sync::Arc;
        // We use a shared rusqlite Connection via a tempfile so we can close
        // and reopen the adapter. The in-memory DB won't round-trip across
        // open() calls, which is exactly the property we're testing.
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();
        {
            let a = SqliteAdapter::open(&path).unwrap();
            a.save("canvas", "events", "persisted").await.unwrap();
            // Drop via going out of scope.
            let _ = Arc::new(a);
        }
        let b = SqliteAdapter::open(&path).unwrap();
        assert_eq!(b.load("canvas", "events").await.unwrap().as_deref(), Some("persisted"),);
    }

    // Traces to: FR-EVT-003
    #[tokio::test]
    async fn delete_via_empty_save_does_not_wipe_row() {
        // Saving an empty string is still a valid cursor (some APIs use "");
        // we treat it as data, not absence.
        let a = adapter().await;
        a.save("canvas", "events", "").await.unwrap();
        assert_eq!(a.load("canvas", "events").await.unwrap().as_deref(), Some(""));
    }
}
