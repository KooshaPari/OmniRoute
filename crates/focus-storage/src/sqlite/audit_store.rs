// SPDX-License-Identifier: MIT OR Apache-2.0

//! SQLite-backed [`AuditStore`] + [`AuditSink`] impl.
//!
//! Mirrors the pattern of the other sqlite stores: an `Arc<tokio::sync::Mutex<Connection>>`
//! with `spawn_blocking` for the async variants, plus a sync implementation
//! that blocks on the same mutex for the `AuditStore` / `AuditSink` traits
//! (which are sync).
//!
//! Traces to: FR-STATE-004, FR-DATA-002.

use anyhow::{Context, Result};
use focus_audit::{AuditChain, AuditRecord, AuditSink, AuditStore, GENESIS_PREV_HASH};
use rusqlite::{params, Connection, OptionalExtension};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::{parse_rfc3339, rfc3339};

/// SQLite-backed audit store. Clone is cheap (Arc).
#[derive(Clone)]
pub struct SqliteAuditStore {
    pub(crate) conn: Arc<Mutex<Connection>>,
}

impl SqliteAuditStore {
    /// Construct from a shared connection (typically the same one owned by
    /// [`super::SqliteAdapter`]).
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    /// Construct from an existing adapter, sharing its connection.
    pub fn from_adapter(adapter: &super::SqliteAdapter) -> Self {
        Self { conn: adapter.conn.clone() }
    }

    // --- async variants -----------------------------------------------------

    /// Async append (runs on blocking pool).
    pub async fn append_async(&self, record: AuditRecord) -> Result<()> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<()> {
            let guard = conn.blocking_lock();
            append_sync(&guard, &record)
        })
        .await
        .context("audit.append join")?
    }

    /// Async verify_chain (runs on blocking pool).
    pub async fn verify_chain_async(&self) -> Result<bool> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<bool> {
            let guard = conn.blocking_lock();
            verify_chain_sync(&guard)
        })
        .await
        .context("audit.verify_chain join")?
    }

    /// Async head_hash (runs on blocking pool).
    pub async fn head_hash_async(&self) -> Result<Option<String>> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<Option<String>> {
            let guard = conn.blocking_lock();
            head_hash_sync(&guard)
        })
        .await
        .context("audit.head_hash join")?
    }

    /// Test-only helper: overwrite the payload column of the row at `seq`,
    /// bypassing the append hash-chain invariant. Exercises tamper detection
    /// from integration tests.
    #[doc(hidden)]
    pub async fn __test_tamper_payload(
        &self,
        seq: i64,
        new_payload: serde_json::Value,
    ) -> Result<()> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<()> {
            let guard = conn.blocking_lock();
            let s = serde_json::to_string(&new_payload).context("serialize tamper payload")?;
            guard
                .execute("UPDATE audit_records SET payload = ?1 WHERE seq = ?2", params![s, seq])
                .context("tamper update")?;
            Ok(())
        })
        .await
        .context("tamper join")?
    }

    /// Load all records in insertion order (test/debug helper).
    pub async fn load_all(&self) -> Result<Vec<AuditRecord>> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || -> Result<Vec<AuditRecord>> {
            let guard = conn.blocking_lock();
            load_all_sync(&guard)
        })
        .await
        .context("audit.load_all join")?
    }
}

// --- sync helpers -----------------------------------------------------------

fn head_hash_sync(conn: &Connection) -> Result<Option<String>> {
    let row: Option<String> = conn
        .query_row("SELECT hash FROM audit_records ORDER BY seq DESC LIMIT 1", [], |r| r.get(0))
        .optional()
        .context("query head_hash")?;
    Ok(row)
}

fn append_sync(conn: &Connection, record: &AuditRecord) -> Result<()> {
    let expected_prev = head_hash_sync(conn)?.unwrap_or_else(|| GENESIS_PREV_HASH.to_string());
    if record.prev_hash != expected_prev {
        anyhow::bail!(
            "prev_hash mismatch on append: expected {expected_prev}, got {}",
            record.prev_hash
        );
    }
    let next_seq: i64 = conn
        .query_row("SELECT COALESCE(MAX(seq), 0) + 1 FROM audit_records", [], |r| r.get(0))
        .context("compute next audit seq")?;
    let payload = serde_json::to_string(&record.payload).context("serialize audit payload")?;
    conn.execute(
        "INSERT INTO audit_records (id, record_type, subject_ref, occurred_at, prev_hash, payload, hash, seq) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            record.id.to_string(),
            record.record_type,
            record.subject_ref,
            rfc3339(record.occurred_at),
            record.prev_hash,
            payload,
            record.hash,
            next_seq,
        ],
    )
    .context("insert audit_record")?;
    Ok(())
}

fn load_all_sync(conn: &Connection) -> Result<Vec<AuditRecord>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, record_type, subject_ref, occurred_at, prev_hash, payload, hash \
             FROM audit_records ORDER BY seq ASC",
        )
        .context("prepare load_all")?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .context("query load_all")?;
    let mut out = Vec::new();
    for row in rows {
        let (id, rt, sref, occ, prev, payload, hash) = row.context("audit row")?;
        let payload: serde_json::Value =
            serde_json::from_str(&payload).context("deserialize audit payload")?;
        out.push(AuditRecord {
            id: Uuid::parse_str(&id).context("parse audit id")?,
            record_type: rt,
            subject_ref: sref,
            occurred_at: parse_rfc3339(&occ)?,
            prev_hash: prev,
            payload,
            hash,
        });
    }
    Ok(out)
}

fn verify_chain_sync(conn: &Connection) -> Result<bool> {
    let records = load_all_sync(conn)?;
    if records.is_empty() {
        return Ok(true);
    }
    let chain = AuditChain { records };
    match chain.verify() {
        Ok(()) => Ok(true),
        Err(focus_audit::ChainError::Empty) => Ok(true),
        Err(_) => Ok(false),
    }
}

// --- trait impls ------------------------------------------------------------

/// Acquire the mutex, handling the two possible calling contexts:
///
/// * **inside a tokio runtime (multi_thread):** delegate to `block_in_place`
///   so we don't deadlock the runtime.
/// * **outside a runtime:** use `blocking_lock` directly.
///
/// A `current_thread` runtime cannot use `block_in_place`; callers in that
/// context must use the async variants (`*_async`). The sync trait impls
/// below therefore require a multi-thread runtime when invoked async-side.
fn with_locked<F, R>(conn: &Arc<Mutex<Connection>>, f: F) -> R
where
    F: FnOnce(&Connection) -> R,
{
    if tokio::runtime::Handle::try_current().is_ok() {
        tokio::task::block_in_place(|| {
            let guard = conn.blocking_lock();
            f(&guard)
        })
    } else {
        let guard = conn.blocking_lock();
        f(&guard)
    }
}

impl AuditStore for SqliteAuditStore {
    fn append(&self, record: AuditRecord) -> anyhow::Result<()> {
        with_locked(&self.conn, |c| append_sync(c, &record))
    }

    fn verify_chain(&self) -> anyhow::Result<bool> {
        with_locked(&self.conn, verify_chain_sync)
    }

    fn head_hash(&self) -> anyhow::Result<Option<String>> {
        with_locked(&self.conn, head_hash_sync)
    }
}

impl AuditSink for SqliteAuditStore {
    fn record_mutation(
        &self,
        record_type: &str,
        subject_ref: &str,
        payload: serde_json::Value,
        now: chrono::DateTime<chrono::Utc>,
    ) -> anyhow::Result<()> {
        focus_audit::append_mutation(self, record_type, subject_ref, &payload, now)?;
        Ok(())
    }
}
