// SPDX-License-Identifier: MIT OR Apache-2.0

//! Event deduplication: canonical-hash + bloom filter + SQLite exact-match table.
//!
//! Prevents duplicate event processing when connectors emit duplicates (webhook retry,
//! polling overlap). Algorithm:
//!
//! 1. Compute canonical SHA-256 hash from (connector_id, event_type, normalized_payload_json)
//! 2. Check bloom filter (fast, no false negatives, may have false positives)
//! 3. On bloom-filter hit, exact-match check in SQLite dedupe table
//! 4. If exact match, skip event; else process and insert hash with TTL (30 days)
//! 5. Background task purges expired entries (> 30 days old)
//!
//! Traces to: FR-EVT-DEDUP-001.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use thiserror::Error;

#[derive(Debug, Error, PartialEq)]
pub enum DedupeError {
    #[error("hash computation failed: {0}")]
    HashFailed(String),
    #[error("bloom filter error: {0}")]
    BloomError(String),
    #[error("database error: {0}")]
    DatabaseError(String),
}

/// Result type for deduplication operations.
pub type DedupeResult<T> = std::result::Result<T, DedupeError>;

/// Opaque dedupe key (SHA-256 hash as hex string).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DedupeKey(pub String);

/// Canonical event hash, computed deterministically from event components.
pub fn compute_canonical_hash(
    connector_id: &str,
    event_type: &str,
    payload: &serde_json::Value,
) -> DedupeResult<DedupeKey> {
    // Normalize payload by sorting keys (JSON object key order doesn't matter)
    let normalized = normalize_json_keys(payload)
        .map_err(|e| DedupeError::HashFailed(e.to_string()))?;

    // Construct deterministic input: connector_id || event_type || normalized_json
    let input = format!(
        "{}||{}||{}",
        connector_id,
        event_type,
        normalized
    );

    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let hash_bytes = hasher.finalize();
    let hash_hex = hex::encode(hash_bytes);

    Ok(DedupeKey(hash_hex))
}

/// Normalize JSON by sorting object keys recursively for deterministic hashing.
fn normalize_json_keys(value: &serde_json::Value) -> serde_json::Result<serde_json::Value> {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted = serde_json::Map::new();
            let mut keys: Vec<_> = map.keys().collect();
            keys.sort();
            for key in keys {
                let normalized_val = normalize_json_keys(&map[key])?;
                sorted.insert(key.clone(), normalized_val);
            }
            Ok(serde_json::Value::Object(sorted))
        }
        serde_json::Value::Array(arr) => {
            let normalized: serde_json::Result<Vec<_>> =
                arr.iter().map(normalize_json_keys).collect();
            Ok(serde_json::Value::Array(normalized?))
        }
        other => Ok(other.clone()),
    }
}

/// Trait for checking and marking event deduplication.
#[async_trait]
pub trait EventDeduplicator: Send + Sync {
    /// Check if an event hash has been seen recently.
    async fn is_seen(&self, key: &DedupeKey) -> DedupeResult<bool>;

    /// Mark an event hash as seen with a TTL (seconds). Typically 30 days = 2_592_000 sec.
    async fn mark_seen(&self, key: &DedupeKey, ttl_sec: i64) -> DedupeResult<()>;

    /// Purge dedupe entries older than the given cutoff timestamp.
    async fn purge_older_than(&self, cutoff: DateTime<Utc>) -> DedupeResult<usize>;
}

/// No-op deduplicator for tests and scenarios where durability is not required.
#[derive(Debug, Default)]
pub struct NoopDeduplicator;

#[async_trait]
impl EventDeduplicator for NoopDeduplicator {
    async fn is_seen(&self, _key: &DedupeKey) -> DedupeResult<bool> {
        Ok(false)
    }

    async fn mark_seen(&self, _key: &DedupeKey, _ttl_sec: i64) -> DedupeResult<()> {
        Ok(())
    }

    async fn purge_older_than(&self, _cutoff: DateTime<Utc>) -> DedupeResult<usize> {
        Ok(0)
    }
}

/// In-memory bloom-filter backed deduplicator (for testing).
/// Fast, no I/O; used to validate logic before wiring the real SQLite backend.
#[derive(Debug, Clone)]
pub struct InMemoryDeduplicator {
    seen: std::sync::Arc<parking_lot::RwLock<HashSet<String>>>,
}

impl InMemoryDeduplicator {
    pub fn new() -> Self {
        Self {
            seen: std::sync::Arc::new(parking_lot::RwLock::new(HashSet::new())),
        }
    }
}

impl Default for InMemoryDeduplicator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl EventDeduplicator for InMemoryDeduplicator {
    async fn is_seen(&self, key: &DedupeKey) -> DedupeResult<bool> {
        Ok(self.seen.read().contains(&key.0))
    }

    async fn mark_seen(&self, key: &DedupeKey, _ttl_sec: i64) -> DedupeResult<()> {
        self.seen.write().insert(key.0.clone());
        Ok(())
    }

    async fn purge_older_than(&self, _cutoff: DateTime<Utc>) -> DedupeResult<usize> {
        // In-memory impl doesn't track timestamps; no-op.
        Ok(0)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn canonical_hash_deterministic_same_payload() {
        let payload = json!({ "id": "123", "value": 42 });
        let hash1 = compute_canonical_hash("connector-a", "event_type_x", &payload)
            .expect("hash1");
        let hash2 = compute_canonical_hash("connector-a", "event_type_x", &payload)
            .expect("hash2");
        assert_eq!(hash1, hash2);
    }

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn canonical_hash_different_key_order_same_hash() {
        let payload1 = json!({ "id": "123", "value": 42 });
        let payload2 = json!({ "value": 42, "id": "123" });
        let hash1 = compute_canonical_hash("connector-a", "event_type_x", &payload1)
            .expect("hash1");
        let hash2 = compute_canonical_hash("connector-a", "event_type_x", &payload2)
            .expect("hash2");
        assert_eq!(hash1, hash2, "JSON key order should not affect hash");
    }

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn canonical_hash_different_connector_different_hash() {
        let payload = json!({ "id": "123", "value": 42 });
        let hash_a = compute_canonical_hash("connector-a", "event_type_x", &payload)
            .expect("hash_a");
        let hash_b = compute_canonical_hash("connector-b", "event_type_x", &payload)
            .expect("hash_b");
        assert_ne!(hash_a, hash_b);
    }

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn canonical_hash_different_event_type_different_hash() {
        let payload = json!({ "id": "123", "value": 42 });
        let hash_x =
            compute_canonical_hash("connector-a", "event_type_x", &payload).expect("hash_x");
        let hash_y =
            compute_canonical_hash("connector-a", "event_type_y", &payload).expect("hash_y");
        assert_ne!(hash_x, hash_y);
    }

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn canonical_hash_different_payload_different_hash() {
        let payload1 = json!({ "id": "123", "value": 42 });
        let payload2 = json!({ "id": "123", "value": 99 });
        let hash1 = compute_canonical_hash("connector-a", "event_type_x", &payload1)
            .expect("hash1");
        let hash2 = compute_canonical_hash("connector-a", "event_type_x", &payload2)
            .expect("hash2");
        assert_ne!(hash1, hash2);
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn in_memory_deduplicator_tracks_seen() {
        let dedup = InMemoryDeduplicator::new();
        let key = DedupeKey("hash1".to_string());

        // Initially not seen
        assert!(!dedup.is_seen(&key).await.expect("is_seen"));

        // Mark as seen
        dedup.mark_seen(&key, 2_592_000).await.expect("mark_seen");

        // Now seen
        assert!(dedup.is_seen(&key).await.expect("is_seen"));
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn in_memory_deduplicator_independent_keys() {
        let dedup = InMemoryDeduplicator::new();
        let key1 = DedupeKey("hash1".to_string());
        let key2 = DedupeKey("hash2".to_string());

        dedup.mark_seen(&key1, 2_592_000).await.expect("mark_seen");

        // key1 is seen, key2 is not
        assert!(dedup.is_seen(&key1).await.expect("is_seen"));
        assert!(!dedup.is_seen(&key2).await.expect("is_seen"));
    }

    // Traces to: FR-EVT-DEDUP-001
    #[tokio::test]
    async fn noop_deduplicator_always_unseen() {
        let dedup = NoopDeduplicator;
        let key = DedupeKey("hash1".to_string());

        assert!(!dedup.is_seen(&key).await.expect("is_seen"));
        dedup.mark_seen(&key, 2_592_000).await.expect("mark_seen");
        assert!(!dedup.is_seen(&key).await.expect("is_seen"));
    }

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn normalize_json_keys_simple_object() {
        let input = json!({ "z": 1, "a": 2 });
        let normalized = normalize_json_keys(&input).expect("normalize");
        // Keys should be sorted
        let keys: Vec<_> = normalized
            .as_object()
            .expect("object")
            .keys()
            .collect();
        assert_eq!(keys, vec!["a", "z"]);
    }

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn normalize_json_keys_nested_object() {
        let input = json!({
            "outer": { "z": 1, "a": 2 },
            "simple": 42
        });
        let normalized = normalize_json_keys(&input).expect("normalize");
        let outer = normalized.get("outer").expect("outer");
        let outer_keys: Vec<_> = outer
            .as_object()
            .expect("object")
            .keys()
            .collect();
        assert_eq!(outer_keys, vec!["a", "z"]);
    }

    // Traces to: FR-EVT-DEDUP-001
    #[test]
    fn normalize_json_keys_array_preserved() {
        let input = json!({ "items": [1, 2, 3] });
        let normalized = normalize_json_keys(&input).expect("normalize");
        let items = normalized.get("items").expect("items");
        assert!(items.is_array());
        let arr = items.as_array().expect("array");
        assert_eq!(arr.len(), 3);
    }
}
