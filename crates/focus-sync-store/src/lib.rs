// SPDX-License-Identifier: MIT OR Apache-2.0

//! Multi-device sync store trait and in-memory implementations.
//!
//! This crate defines the abstract sync interface that FocalPoint uses to sync
//! state (rules, tasks, wallet, penalties) across devices. The trait is backend-agnostic;
//! implementations can use CloudKit (iOS/macOS), CRDT replication, or a custom server.
//!
//! ## Schema
//!
//! Synced records include:
//! - **Rules:** Append-only policies.
//! - **Tasks:** User-authored task list.
//! - **Wallet:** Reward balance + mutation log.
//! - **Penalties:** Penalty state.
//!
//! Non-synced:
//! - **Audit Chain:** Device-local only.
//! - **Connector Tokens:** Per-device; stay in Keychain.
//!
//! ## Conflict Resolution
//!
//! Last-writer-wins (LWW) with a 30-second grace period:
//! - If server version is ≤30s older than local, accept local.
//! - If server is >30s newer, prompt user.
//! - Wallet/Penalty: treat as CRDT counter (accumulate deltas in a log).

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// A record that was synced, pulled, or caused a conflict.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRecord {
    pub record_id: Uuid,
    pub record_type: String, // "Rule", "Task", "Wallet", "Penalty"
    pub device_id: Uuid,
    pub payload_json: serde_json::Value,
    pub device_signature: String, // Ed25519(canonical_json(payload_json), device_private_key)
    pub version: u64,
    pub synced_at: chrono::DateTime<chrono::Utc>,
}

/// Tracks what changed in a sync round: push/pull/conflicts.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncOutcome {
    pub pushed: u32,
    pub pulled: u32,
    pub conflicts: Vec<ConflictRecord>,
    pub status: SyncStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SyncStatus {
    #[serde(rename = "ok")]
    #[default]
    Ok,
    #[serde(rename = "network_error")]
    NetworkError,
    #[serde(rename = "verification_failed")]
    VerificationFailed,
    #[serde(rename = "partial")]
    Partial,
}

/// A conflicting record: local and remote versions differ.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictRecord {
    pub record_id: Uuid,
    pub record_type: String,
    pub local_version: u64,
    pub remote_version: u64,
    pub local_modified_at: chrono::DateTime<chrono::Utc>,
    pub remote_modified_at: chrono::DateTime<chrono::Utc>,
    pub resolution: ConflictResolution,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConflictResolution {
    #[serde(rename = "pending_user")]
    PendingUser,
    #[serde(rename = "local_wins")]
    LocalWins,
    #[serde(rename = "remote_wins")]
    RemoteWins,
}

/// Abstract sync store trait.
///
/// Implementations (CloudKit, CRDT, custom server) provide push/pull semantics.
#[async_trait]
pub trait SyncStore: Send + Sync {
    /// Push local changes to the backend.
    ///
    /// Returns number of records pushed and any verification errors.
    async fn push(&self, records: Vec<SyncRecord>) -> anyhow::Result<u32>;

    /// Pull changes from the backend.
    ///
    /// Returns pulled records and any conflicts detected.
    async fn pull(&self) -> anyhow::Result<(Vec<SyncRecord>, Vec<ConflictRecord>)>;

    /// Verify a device signature on a record.
    ///
    /// Must fetch the device's public key and verify the signature.
    /// Returns true if valid; false if tampered or key not found.
    async fn verify_signature(
        &self,
        device_id: Uuid,
        payload_json: &serde_json::Value,
        signature: &str,
    ) -> anyhow::Result<bool>;

    /// Check if sync is available (e.g., iCloud account is signed in).
    async fn is_available(&self) -> anyhow::Result<bool>;
}

/// In-memory sync store for testing.
///
/// Records push/pull calls and returns deterministic outcomes.
/// Does NOT perform real CloudKit or CRDT operations.
#[derive(Debug, Default, Clone)]
pub struct MemorySyncStore {
    inner: Arc<tokio::sync::Mutex<MemorySyncStoreInner>>,
}

#[derive(Debug, Default)]
struct MemorySyncStoreInner {
    records: Vec<SyncRecord>,
    push_count: u32,
    pull_count: u32,
    available: bool,
}

impl MemorySyncStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(tokio::sync::Mutex::new(MemorySyncStoreInner {
                available: true,
                ..Default::default()
            })),
        }
    }

    /// Get the number of push operations performed.
    pub async fn push_count(&self) -> u32 {
        self.inner.lock().await.push_count
    }

    /// Get the number of pull operations performed.
    pub async fn pull_count(&self) -> u32 {
        self.inner.lock().await.pull_count
    }

    /// Get all stored records.
    pub async fn stored_records(&self) -> Vec<SyncRecord> {
        self.inner.lock().await.records.clone()
    }

    /// Set availability flag for testing.
    pub async fn set_available(&self, available: bool) {
        self.inner.lock().await.available = available;
    }
}

#[async_trait]
impl SyncStore for MemorySyncStore {
    async fn push(&self, records: Vec<SyncRecord>) -> anyhow::Result<u32> {
        let mut inner = self.inner.lock().await;
        let count = records.len() as u32;
        inner.push_count += count;
        inner.records.extend(records);
        Ok(count)
    }

    async fn pull(&self) -> anyhow::Result<(Vec<SyncRecord>, Vec<ConflictRecord>)> {
        let mut inner = self.inner.lock().await;
        inner.pull_count += 1;
        // For testing: return a copy of stored records, no conflicts.
        Ok((inner.records.clone(), vec![]))
    }

    async fn verify_signature(
        &self,
        _device_id: Uuid,
        _payload_json: &serde_json::Value,
        _signature: &str,
    ) -> anyhow::Result<bool> {
        // In-memory store always verifies as valid for testing.
        Ok(true)
    }

    async fn is_available(&self) -> anyhow::Result<bool> {
        Ok(self.inner.lock().await.available)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Trace: FR-SYNC-001 (offline changes persist), FR-SYNC-005 (opt-in)
    #[tokio::test]
    async fn test_memory_store_push_records() {
        let store = MemorySyncStore::new();
        let record = SyncRecord {
            record_id: Uuid::new_v4(),
            record_type: "Rule".to_string(),
            device_id: Uuid::new_v4(),
            payload_json: serde_json::json!({ "name": "test" }),
            device_signature: "sig".to_string(),
            version: 1,
            synced_at: chrono::Utc::now(),
        };

        let count = store.push(vec![record.clone()]).await.unwrap();
        assert_eq!(count, 1);
        assert_eq!(store.push_count().await, 1);

        let records = store.stored_records().await;
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].record_id, record.record_id);
    }

    // Trace: FR-SYNC-002 (eventual consistency)
    #[tokio::test]
    async fn test_memory_store_pull_records() {
        let store = MemorySyncStore::new();
        let record = SyncRecord {
            record_id: Uuid::new_v4(),
            record_type: "Task".to_string(),
            device_id: Uuid::new_v4(),
            payload_json: serde_json::json!({ "title": "Run" }),
            device_signature: "sig".to_string(),
            version: 1,
            synced_at: chrono::Utc::now(),
        };

        store.push(vec![record.clone()]).await.unwrap();

        let (pulled, conflicts) = store.pull().await.unwrap();
        assert_eq!(pulled.len(), 1);
        assert_eq!(conflicts.len(), 0);
        assert_eq!(store.pull_count().await, 1);
    }

    // Trace: FR-SYNC-005 (opt-in)
    #[tokio::test]
    async fn test_sync_availability() {
        let store = MemorySyncStore::new();
        assert!(store.is_available().await.unwrap());

        store.set_available(false).await;
        assert!(!store.is_available().await.unwrap());
    }

    #[tokio::test]
    async fn test_verify_signature_always_valid() {
        let store = MemorySyncStore::new();
        let device_id = Uuid::new_v4();
        let payload = serde_json::json!({ "test": "data" });

        let valid = store
            .verify_signature(device_id, &payload, "fake_sig")
            .await
            .unwrap();
        assert!(valid);
    }

    #[tokio::test]
    async fn test_sync_outcome_serialization() {
        let outcome = SyncOutcome {
            pushed: 5,
            pulled: 3,
            conflicts: vec![],
            status: SyncStatus::Ok,
        };

        let json = serde_json::to_value(&outcome).unwrap();
        assert_eq!(json["pushed"], 5);
        assert_eq!(json["pulled"], 3);
        assert_eq!(json["status"], "ok");
    }
}
