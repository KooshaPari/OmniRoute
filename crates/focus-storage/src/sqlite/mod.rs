// SPDX-License-Identifier: MIT OR Apache-2.0

//! SQLite adapter — schema migrations, prepared statements.
//!
//! Traces to: FR-DATA-001, FR-DATA-002.

use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod audit_store;
pub mod cursor_store;
pub mod event_dedup;
pub mod event_store;
pub mod migrations;
pub mod penalty_store;
pub mod rule_store;
pub mod task_store;
pub mod wallet_store;

/// Sync SQLite adapter, serialized via `tokio::sync::Mutex`.
///
/// All async trait impls acquire the mutex, then run `rusqlite` calls on a
/// `spawn_blocking` worker so the runtime is not blocked by disk I/O.
#[derive(Clone)]
pub struct SqliteAdapter {
    pub(crate) conn: Arc<Mutex<Connection>>,
}

impl SqliteAdapter {
    /// Open (or create) a SQLite database at `path` and apply migrations.
    pub fn open(path: &Path) -> Result<Self> {
        let mut conn = Connection::open(path)
            .with_context(|| format!("open sqlite db at {}", path.display()))?;
        migrations::run(&mut conn)?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    /// Open an in-memory SQLite database (tests).
    pub fn open_in_memory() -> Result<Self> {
        let mut conn = Connection::open_in_memory().context("open sqlite in-memory")?;
        migrations::run(&mut conn)?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    /// Helper for tests: create adapter from a raw Connection with blocking Mutex.
    #[cfg(test)]
    pub(crate) fn new_with_blocking_mutex(conn: Connection) -> Self {
        Self {
            conn: Arc::new(Mutex::new(conn)),
        }
    }
}

// --- Small helpers shared across submodules --------------------------------

pub(crate) fn rfc3339(ts: chrono::DateTime<chrono::Utc>) -> String {
    ts.to_rfc3339()
}

pub(crate) fn parse_rfc3339(s: &str) -> Result<chrono::DateTime<chrono::Utc>> {
    let dt = chrono::DateTime::parse_from_rfc3339(s)
        .with_context(|| format!("parse rfc3339 timestamp: {s}"))?;
    Ok(dt.with_timezone(&chrono::Utc))
}

pub(crate) fn parse_rfc3339_opt(
    s: Option<String>,
) -> Result<Option<chrono::DateTime<chrono::Utc>>> {
    match s {
        Some(v) => Ok(Some(parse_rfc3339(&v)?)),
        None => Ok(None),
    }
}
