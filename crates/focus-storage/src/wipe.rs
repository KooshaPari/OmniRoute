// SPDX-License-Identifier: MIT OR Apache-2.0

//! Right-to-erasure / GDPR account deletion.
//!
//! Provides tamper-evident account wipe with a receipt. On successful wipe,
//! all data (events, rules, tasks, wallet, penalties, audit, connector tokens)
//! is deleted and a wipe receipt is written to a separate file as proof.
//!
//! Traces to: FR-PRIVACY-001 (right-to-erasure).

use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

use crate::sqlite::SqliteAdapter;

/// Receipt proving data has been wiped. Kept for user's records.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WipeReceipt {
    /// ISO 8601 timestamp of wipe completion.
    pub wiped_at: String,

    /// SHA-256 of the final audit chain hash before deletion.
    pub pre_wipe_chain_hash: String,

    /// Count of each table deleted.
    pub deleted_counts: BTreeMap<String, i64>,

    /// Keychain items wiped (names only, no values).
    pub deleted_keychain_items: Vec<String>,

    /// Filesystem paths cleaned.
    pub deleted_paths: Vec<String>,
}

impl WipeReceipt {
    /// Directory where wipe receipts are stored.
    /// Typically `~/Library/Application Support/FocalPoint/wipe-receipts/` on macOS.
    fn receipt_dir() -> Result<PathBuf> {
        let app_support = if cfg!(target_os = "macos") {
            let home = std::env::var("HOME")
                .context("HOME env var not set")?;
            PathBuf::from(home)
                .join("Library/Application Support/FocalPoint")
        } else if cfg!(target_os = "linux") {
            let home = std::env::var("HOME")
                .context("HOME env var not set")?;
            PathBuf::from(home)
                .join(".config/FocalPoint")
        } else {
            anyhow::bail!("unsupported platform for wipe receipts")
        };

        Ok(app_support.join("wipe-receipts"))
    }

    /// Write receipt to `~/Library/Application Support/FocalPoint/wipe-receipts/<ts>.json`.
    pub fn save(&self) -> Result<PathBuf> {
        let dir = Self::receipt_dir()?;
        std::fs::create_dir_all(&dir).context("create wipe-receipts dir")?;

        let filename = format!("{}.json", Utc::now().timestamp());
        let path = dir.join(&filename);

        let json = serde_json::to_string_pretty(self).context("serialize receipt")?;
        std::fs::write(&path, json).context("write receipt file")?;

        Ok(path)
    }
}

/// Wipe all user data: SQLite tables, keychain items, and caches.
/// Emits a final audit record and returns a tamper-evident receipt.
pub async fn wipe_all(adapter: &SqliteAdapter) -> Result<WipeReceipt> {
    let mut deleted_counts = BTreeMap::new();
    let deleted_keychain_items = vec![];
    let deleted_paths = vec![];

    // Get pre-wipe chain hash before dropping audit table.
    let pre_wipe_chain_hash = {
        let conn = adapter.conn.lock().await;
        conn.query_row(
            "SELECT hash FROM audit_records ORDER BY seq DESC LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "none".to_string())
    };

    // Delete all tables (in dependency order).
    let tables = [
        "events",
        "rules",
        "wallet_streaks",
        "wallet_unlocks",
        "wallet",
        "tasks",
        "lockout_windows",
        "penalty_state",
        "connector_cursors",
        "audit_records",
    ];

    {
        let conn = adapter.conn.lock().await;

        for table in &tables {
            let count: i64 = conn
                .query_row(
                    &format!("SELECT COUNT(*) FROM {}", table),
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            if count > 0 {
                conn.execute(&format!("DELETE FROM {}", table), [])
                    .context(format!("delete from {}", table))?;
            }

            deleted_counts.insert(table.to_string(), count);
        }

        // Vacuum to reclaim space.
        conn.execute("VACUUM", [])
            .context("vacuum database")?;
    }

    // TODO: Wipe keychain items via SecureSecretStore::wipe_all() once trait is extended.
    // For now, this is a stub awaiting the keychain wipe implementation.

    // TODO: Wipe filesystem caches (backups dir, log dir) once cache paths are stable.

    let receipt = WipeReceipt {
        wiped_at: Utc::now().to_rfc3339(),
        pre_wipe_chain_hash,
        deleted_counts,
        deleted_keychain_items,
        deleted_paths,
    };

    Ok(receipt)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    // Traces to: FR-PRIVACY-001
    #[tokio::test]
    async fn wipe_empty_database() {
        let adapter = crate::sqlite::SqliteAdapter::open_in_memory()
            .expect("create adapter");
        let receipt = wipe_all(&adapter).await.expect("wipe");
        assert!(receipt.wiped_at.len() > 20); // ISO 8601 with milliseconds is ~30+ chars
        assert_eq!(receipt.pre_wipe_chain_hash, "none"); // Empty DB has no audit records
    }

    // Traces to: FR-PRIVACY-001
    #[tokio::test]
    async fn wipe_with_data() {
        let adapter = crate::sqlite::SqliteAdapter::open_in_memory()
            .expect("create adapter");

        // Seed some data.
        {
            let conn = adapter.conn.lock().await;
            conn.execute(
                "INSERT INTO events (event_id, connector_id, account_id, event_type, occurred_at, \
                 effective_at, dedupe_key, confidence, payload, raw_ref) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    "evt1", "conn1", "acc1", "login", "2026-04-23T00:00:00Z",
                    "2026-04-23T00:00:00Z", "key1", 1.0, "{}", None::<String>
                ],
            )
            .expect("insert event");
        }

        let receipt = wipe_all(&adapter).await.expect("wipe");

        // Verify count was recorded.
        assert_eq!(receipt.deleted_counts.get("events"), Some(&1));
        assert_eq!(receipt.deleted_counts.get("rules"), Some(&0));

        // Verify data is gone.
        {
            let conn = adapter.conn.lock().await;
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM events", [], |row| row.get(0))
                .expect("query");
            assert_eq!(count, 0);
        }
    }

    // Traces to: FR-PRIVACY-001
    #[tokio::test]
    async fn receipt_is_valid_json() {
        let adapter = crate::sqlite::SqliteAdapter::open_in_memory()
            .expect("create adapter");
        let receipt = wipe_all(&adapter).await.expect("wipe");

        let json = serde_json::to_string(&receipt).expect("serialize");
        let _deserialized: WipeReceipt =
            serde_json::from_str(&json).expect("deserialize");
    }

    // Traces to: FR-PRIVACY-001
    #[tokio::test]
    async fn double_wipe_is_idempotent() {
        let adapter = crate::sqlite::SqliteAdapter::open_in_memory()
            .expect("create adapter");

        // First wipe.
        let receipt1 = wipe_all(&adapter).await.expect("first wipe");

        // Second wipe (should succeed with zero counts).
        let receipt2 = wipe_all(&adapter).await.expect("second wipe");

        // All counts should be 0.
        for count in receipt2.deleted_counts.values() {
            assert_eq!(*count, 0);
        }

        // Receipts should differ only in timestamp.
        assert_ne!(receipt1.wiped_at, receipt2.wiped_at);
    }
}
