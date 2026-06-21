// SPDX-License-Identifier: MIT OR Apache-2.0

//! CloudKit port abstraction for multi-device sync.
//!
//! This module defines the trait interface for CloudKit sync operations.
//! The Swift side implements the actual CloudKit calls; this trait is called
//! by Rust-side orchestration code to push/pull wallet, audit, and rule records.
//!
//! Traces to: FR-SYNC-001 (CloudKit-based multi-device replication)

use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;
use uuid::Uuid;

/// CloudKit port trait — implemented by Swift side.
///
/// All methods are async and return Results. Errors are propagated as
/// [`CloudKitPortError`] for Rust-side handling.
#[async_trait::async_trait]
pub trait CloudKitPort: Send + Sync + fmt::Debug {
    /// Check if iCloud account is available.
    async fn check_sync_status(&self) -> Result<(), CloudKitPortError>;

    /// Push wallet, audit, and rule records to CloudKit.
    ///
    /// Records are serialized to canonical JSON, signed with device key,
    /// and sent to the private CloudKit database in zone `focalpoint-sync-v1`.
    ///
    /// On success, returns the count of records saved.
    async fn push(&self, records: Vec<CloudKitRecord>) -> Result<usize, CloudKitPortError>;

    /// Pull remote changes from CloudKit since the last sync.
    ///
    /// Fetches Wallet, AuditRecord, and Rule records from the private zone.
    /// Returns both successfully-synced records and any conflicts detected.
    async fn pull(&self) -> Result<PullOutcome, CloudKitPortError>;

    /// Register subscriptions for push notifications.
    ///
    /// Enables background app refresh when records change on other devices.
    async fn setup_subscription(&self) -> Result<(), CloudKitPortError>;

    /// Get the timestamp of the last successful sync.
    async fn get_last_sync_time(&self) -> Result<Option<std::time::SystemTime>, CloudKitPortError>;

    /// Store the timestamp of the last successful sync.
    async fn set_last_sync_time(&self, time: std::time::SystemTime)
        -> Result<(), CloudKitPortError>;
}

/// A record to push to or pull from CloudKit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudKitRecord {
    /// UUID of the record (stable across devices)
    pub record_id: Uuid,
    /// Record type: "Wallet", "AuditRecord", or "Rule"
    pub record_type: String,
    /// Device ID that originated this record
    pub device_id: Uuid,
    /// Canonical JSON payload (bytes)
    pub payload_json: Vec<u8>,
    /// Device signature over payload (Ed25519)
    pub device_signature: String,
    /// Version number for conflict resolution
    pub version: u64,
    /// When this record was synced
    pub synced_at: std::time::SystemTime,
}

/// Outcome of a pull operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullOutcome {
    /// Records fetched from the remote
    pub pulled: Vec<CloudKitRecord>,
    /// Any conflicts detected during the pull
    pub conflicts: Vec<ConflictRecord>,
}

/// A detected conflict during pull.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictRecord {
    pub record_id: Uuid,
    pub record_type: String,
    pub local_version: u64,
    pub remote_version: u64,
    pub local_modified_at: std::time::SystemTime,
    pub remote_modified_at: std::time::SystemTime,
    pub resolution: ConflictResolution,
}

/// How a conflict should be resolved.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConflictResolution {
    /// User action required
    PendingUser,
    /// Local version wins
    LocalWins,
    /// Remote version wins
    RemoteWins,
}

/// CloudKit port errors.
#[derive(Debug, Error)]
pub enum CloudKitPortError {
    #[error("iCloud unavailable: {0}")]
    ICloudUnavailable(String),
    #[error("push failed: {0}")]
    PushFailed(String),
    #[error("pull failed: {0}")]
    PullFailed(String),
    #[error("signature verification failed")]
    SignatureVerificationFailed,
    #[error("network error: {0}")]
    NetworkError(String),
    #[error("unknown error: {0}")]
    Unknown(String),
}

/// No-op CloudKit port for testing (Rust-side only).
#[derive(Debug)]
pub struct NoopCloudKitPort;

#[async_trait::async_trait]
impl CloudKitPort for NoopCloudKitPort {
    async fn check_sync_status(&self) -> Result<(), CloudKitPortError> {
        Ok(())
    }

    async fn push(&self, records: Vec<CloudKitRecord>) -> Result<usize, CloudKitPortError> {
        Ok(records.len())
    }

    async fn pull(&self) -> Result<PullOutcome, CloudKitPortError> {
        Ok(PullOutcome { pulled: vec![], conflicts: vec![] })
    }

    async fn setup_subscription(&self) -> Result<(), CloudKitPortError> {
        Ok(())
    }

    async fn get_last_sync_time(
        &self,
    ) -> Result<Option<std::time::SystemTime>, CloudKitPortError> {
        Ok(None)
    }

    async fn set_last_sync_time(
        &self,
        _time: std::time::SystemTime,
    ) -> Result<(), CloudKitPortError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-SYNC-001
    #[tokio::test]
    async fn noop_port_returns_empty_pull() {
        let port = NoopCloudKitPort;
        let outcome = port.pull().await.unwrap();
        assert!(outcome.pulled.is_empty());
        assert!(outcome.conflicts.is_empty());
    }

    // Traces to: FR-SYNC-001
    #[tokio::test]
    async fn noop_port_echoes_push_count() {
        let port = NoopCloudKitPort;
        let records = vec![
            CloudKitRecord {
                record_id: Uuid::new_v4(),
                record_type: "Wallet".into(),
                device_id: Uuid::new_v4(),
                payload_json: vec![],
                device_signature: "sig".into(),
                version: 1,
                synced_at: std::time::SystemTime::now(),
            },
        ];
        let count = port.push(records).await.unwrap();
        assert_eq!(count, 1);
    }

    // Traces to: FR-SYNC-001
    #[tokio::test]
    async fn cloudkit_record_can_be_serialized() {
        let record = CloudKitRecord {
            record_id: Uuid::new_v4(),
            record_type: "Rule".into(),
            device_id: Uuid::new_v4(),
            payload_json: b"{}".to_vec(),
            device_signature: "ed25519_sig_here".into(),
            version: 1,
            synced_at: std::time::SystemTime::now(),
        };

        let json = serde_json::to_string(&record).unwrap();
        let deserialized: CloudKitRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.record_id, record.record_id);
        assert_eq!(deserialized.record_type, "Rule");
    }

    // Traces to: FR-SYNC-001
    #[tokio::test]
    async fn conflict_record_resolves_locally() {
        let now = std::time::SystemTime::now();
        let conflict = ConflictRecord {
            record_id: Uuid::new_v4(),
            record_type: "Wallet".into(),
            local_version: 5,
            remote_version: 3,
            local_modified_at: now,
            remote_modified_at: now,
            resolution: ConflictResolution::LocalWins,
        };

        assert_eq!(conflict.resolution, ConflictResolution::LocalWins);
        assert!(conflict.local_version > conflict.remote_version);
    }

    // Traces to: FR-SYNC-001
    #[tokio::test]
    async fn noop_port_accepts_subscriptions() {
        let port = NoopCloudKitPort;
        let result = port.setup_subscription().await;
        assert!(result.is_ok());
    }
}
