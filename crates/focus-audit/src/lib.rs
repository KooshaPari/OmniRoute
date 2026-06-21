// SPDX-License-Identifier: MIT OR Apache-2.0

//! Append-only audit log with a tamper-evident SHA-256 hash chain.
//!
//! Each [`AuditRecord`] commits to the hash of its predecessor, the first
//! record's `prev_hash` being the literal string `"genesis"`. Hashes are
//! computed over a canonicalized representation of the payload (see
//! [`canonical::canonicalize`]) so that semantically-equal JSON always
//! produces the same digest across runs and platforms.

// Workspace clippy.toml disallows `unwrap()` for production code. Test
// modules legitimately need it for assertion scaffolding; scoped allow.
#![cfg_attr(test, allow(clippy::disallowed_methods))]

pub mod canonical;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use focus_observability::{AuditSpanAttrs, MetricsRegistry};

/// Sentinel `prev_hash` for the first record in a chain.
pub const GENESIS_PREV_HASH: &str = "genesis";

#[derive(Debug, thiserror::Error)]
pub enum ChainError {
    #[error("chain is empty")]
    Empty,
    #[error("hash mismatch at index {index}: expected {expected}, got {actual}")]
    HashMismatch { index: usize, expected: String, actual: String },
    #[error("prev_hash link broken at index {index}")]
    PrevHashBroken { index: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    pub id: uuid::Uuid,
    pub record_type: String,
    pub subject_ref: String,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
    pub prev_hash: String,
    pub payload: serde_json::Value,
    pub hash: String,
}

impl AuditRecord {
    /// Compute the SHA-256 hash for a record.
    ///
    /// The payload is canonicalized (recursively sorted object keys) to make
    /// the hash stable regardless of serialization order.
    pub fn compute_hash(
        record_type: &str,
        subject_ref: &str,
        occurred_at: &chrono::DateTime<chrono::Utc>,
        prev_hash: &str,
        payload: &serde_json::Value,
    ) -> String {
        let mut h = Sha256::new();
        h.update(record_type.as_bytes());
        h.update(b"\x00");
        h.update(subject_ref.as_bytes());
        h.update(b"\x00");
        h.update(occurred_at.to_rfc3339().as_bytes());
        h.update(b"\x00");
        h.update(prev_hash.as_bytes());
        h.update(b"\x00");
        h.update(canonical::canonicalize(payload).as_bytes());
        hex::encode(h.finalize())
    }

    /// Recompute this record's hash (for verification).
    pub fn recompute_hash(&self) -> String {
        Self::compute_hash(
            &self.record_type,
            &self.subject_ref,
            &self.occurred_at,
            &self.prev_hash,
            &self.payload,
        )
    }
}

/// In-memory append-only hash chain.
#[derive(Debug, Default, Clone)]
pub struct AuditChain {
    pub records: Vec<AuditRecord>,
}

impl AuditChain {
    pub fn new() -> Self {
        Self { records: Vec::new() }
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    /// Return the hash of the tip record, or [`GENESIS_PREV_HASH`] if empty.
    pub fn head_hash(&self) -> &str {
        self.records.last().map(|r| r.hash.as_str()).unwrap_or(GENESIS_PREV_HASH)
    }

    /// Append a new record, computing its `prev_hash` and `hash`.
    pub fn append(
        &mut self,
        record_type: impl Into<String>,
        subject_ref: impl Into<String>,
        payload: serde_json::Value,
        now: chrono::DateTime<chrono::Utc>,
    ) -> AuditRecord {
        let span_start = Instant::now();
        let record_type = record_type.into();
        let subject_ref = subject_ref.into();
        let prev_hash = self.head_hash().to_string();
        let hash =
            AuditRecord::compute_hash(&record_type, &subject_ref, &now, &prev_hash, &payload);
        let record = AuditRecord {
            id: uuid::Uuid::new_v4(),
            record_type: record_type.clone(),
            subject_ref,
            occurred_at: now,
            prev_hash,
            payload,
            hash,
        };
        let duration_ms = span_start.elapsed().as_millis() as u64;

        // Record metrics
        let metrics = MetricsRegistry::global();
        metrics.inc_audit_appends(&record_type, 1.0);

        let attrs = AuditSpanAttrs::new(record_type.clone())
            .with_entry_count(self.records.len() + 1)
            .with_duration(duration_ms);
        tracing::info!(
            audit_type = %record_type,
            entry_count = self.records.len() + 1,
            duration_ms = duration_ms,
            span_attrs = ?attrs,
            "audit.append span"
        );

        self.records.push(record.clone());
        record
    }

    /// Walk the chain and verify hash/prev-hash integrity.
    ///
    /// Returns [`ChainError::Empty`] if the chain has no records,
    /// [`ChainError::PrevHashBroken`] if a record's `prev_hash` doesn't match
    /// its predecessor's `hash`, and [`ChainError::HashMismatch`] if a record's
    /// `hash` doesn't match a recomputation from its own fields.
    pub fn verify(&self) -> Result<(), ChainError> {
        if self.records.is_empty() {
            return Err(ChainError::Empty);
        }
        let mut expected_prev = GENESIS_PREV_HASH.to_string();
        for (index, rec) in self.records.iter().enumerate() {
            if rec.prev_hash != expected_prev {
                return Err(ChainError::PrevHashBroken { index });
            }
            let recomputed = rec.recompute_hash();
            if recomputed != rec.hash {
                return Err(ChainError::HashMismatch {
                    index,
                    expected: recomputed,
                    actual: rec.hash.clone(),
                });
            }
            expected_prev = rec.hash.clone();
        }
        Ok(())
    }
}

/// Storage abstraction for audit records. SQLite-backed implementations live
/// in `focus-storage`; this crate provides an in-memory reference impl.
pub trait AuditStore: Send + Sync {
    fn append(&self, record: AuditRecord) -> anyhow::Result<()>;
    fn verify_chain(&self) -> anyhow::Result<bool>;
    /// Return the tip hash (or `None` if the chain is empty).
    fn head_hash(&self) -> anyhow::Result<Option<String>>;
}

/// Convenience: construct + hash + append an audit record derived from a
/// serializable payload. Used by state-mutation callers so they don't have to
/// hand-wire hash + prev_hash + uuid on every `apply()`.
///
/// Returns the appended record (with its assigned `id`, `prev_hash`, and `hash`).
pub fn append_mutation<S: serde::Serialize>(
    store: &dyn AuditStore,
    record_type: &str,
    subject_ref: &str,
    payload: &S,
    now: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<AuditRecord> {
    let payload_value = serde_json::to_value(payload)
        .map_err(|e| anyhow::anyhow!("serialize audit payload: {e}"))?;
    let prev_hash = store.head_hash()?.unwrap_or_else(|| GENESIS_PREV_HASH.to_string());
    let hash =
        AuditRecord::compute_hash(record_type, subject_ref, &now, &prev_hash, &payload_value);
    let record = AuditRecord {
        id: uuid::Uuid::new_v4(),
        record_type: record_type.to_string(),
        subject_ref: subject_ref.to_string(),
        occurred_at: now,
        prev_hash,
        payload: payload_value,
        hash,
    };
    store.append(record.clone())?;
    Ok(record)
}

/// Lighter-weight injectable sink for state-mutation callers. Implementers
/// must serialize the given payload into an audit record and append it to
/// their underlying store. All methods must be safely callable from any
/// thread (hence `Send + Sync`).
pub trait AuditSink: Send + Sync {
    fn record_mutation(
        &self,
        record_type: &str,
        subject_ref: &str,
        payload: serde_json::Value,
        now: chrono::DateTime<chrono::Utc>,
    ) -> anyhow::Result<()>;
}

/// Blanket: any `Arc<dyn AuditStore>` also acts as an `AuditSink`.
impl AuditSink for Arc<dyn AuditStore> {
    fn record_mutation(
        &self,
        record_type: &str,
        subject_ref: &str,
        payload: serde_json::Value,
        now: chrono::DateTime<chrono::Utc>,
    ) -> anyhow::Result<()> {
        append_mutation(self.as_ref(), record_type, subject_ref, &payload, now)?;
        Ok(())
    }
}

/// No-op sink for tests and callers that intentionally discard audit.
/// Using this still type-checks the "every mutation receives a sink" contract
/// without forcing every test to materialize a store.
#[derive(Debug, Default, Clone, Copy)]
pub struct NoopAuditSink;

impl AuditSink for NoopAuditSink {
    fn record_mutation(
        &self,
        _record_type: &str,
        _subject_ref: &str,
        _payload: serde_json::Value,
        _now: chrono::DateTime<chrono::Utc>,
    ) -> anyhow::Result<()> {
        Ok(())
    }
}

/// In-memory [`AuditStore`] backed by an [`AuditChain`].
#[derive(Debug, Default)]
pub struct InMemoryAuditStore {
    pub chain: Mutex<AuditChain>,
}

impl InMemoryAuditStore {
    pub fn new() -> Self {
        Self { chain: Mutex::new(AuditChain::new()) }
    }

    /// Return the most recent `limit` records in newest-first order. Used
    /// by UI surfaces (iOS "Activity" tab, CLI `phenotype audit tail`) that
    /// need a cheap finite window into the chain without loading everything.
    pub fn load_recent(&self, limit: usize) -> Vec<AuditRecord> {
        let chain = match self.chain.lock() {
            Ok(g) => g,
            Err(_) => return Vec::new(),
        };
        let total = chain.records.len();
        let start = total.saturating_sub(limit);
        chain.records[start..].iter().rev().cloned().collect()
    }
}

impl AuditStore for InMemoryAuditStore {
    fn append(&self, record: AuditRecord) -> anyhow::Result<()> {
        let mut chain =
            self.chain.lock().map_err(|e| anyhow::anyhow!("audit chain mutex poisoned: {e}"))?;
        // Caller-constructed record; trust-but-verify its prev_hash link.
        let expected_prev = chain.head_hash().to_string();
        if record.prev_hash != expected_prev {
            anyhow::bail!(
                "prev_hash mismatch on append: expected {expected_prev}, got {}",
                record.prev_hash
            );
        }
        chain.records.push(record);
        Ok(())
    }

    fn verify_chain(&self) -> anyhow::Result<bool> {
        let chain =
            self.chain.lock().map_err(|e| anyhow::anyhow!("audit chain mutex poisoned: {e}"))?;
        match chain.verify() {
            Ok(()) => Ok(true),
            Err(ChainError::Empty) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    fn head_hash(&self) -> anyhow::Result<Option<String>> {
        let chain =
            self.chain.lock().map_err(|e| anyhow::anyhow!("audit chain mutex poisoned: {e}"))?;
        Ok(if chain.is_empty() { None } else { Some(chain.head_hash().to_string()) })
    }
}

impl AuditSink for InMemoryAuditStore {
    fn record_mutation(
        &self,
        record_type: &str,
        subject_ref: &str,
        payload: serde_json::Value,
        now: chrono::DateTime<chrono::Utc>,
    ) -> anyhow::Result<()> {
        append_mutation(self, record_type, subject_ref, &payload, now)?;
        Ok(())
    }
}

/// A single captured mutation: `(record_type, subject_ref, payload, occurred_at)`.
pub type CapturedRecord = (String, String, serde_json::Value, chrono::DateTime<chrono::Utc>);

/// Test helper sink that captures every mutation for later inspection.
#[derive(Debug, Default)]
pub struct CapturingAuditSink {
    pub records: Mutex<Vec<CapturedRecord>>,
}

impl CapturingAuditSink {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn snapshot(
        &self,
    ) -> Vec<(String, String, serde_json::Value, chrono::DateTime<chrono::Utc>)> {
        self.records.lock().expect("capturing audit sink poisoned").clone()
    }

    pub fn len(&self) -> usize {
        self.records.lock().expect("capturing audit sink poisoned").len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl AuditSink for CapturingAuditSink {
    fn record_mutation(
        &self,
        record_type: &str,
        subject_ref: &str,
        payload: serde_json::Value,
        now: chrono::DateTime<chrono::Utc>,
    ) -> anyhow::Result<()> {
        let mut g = self
            .records
            .lock()
            .map_err(|e| anyhow::anyhow!("capturing audit sink poisoned: {e}"))?;
        g.push((record_type.to_string(), subject_ref.to_string(), payload, now));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ts(n: i64) -> chrono::DateTime<chrono::Utc> {
        chrono::DateTime::from_timestamp(1_700_000_000 + n, 0).unwrap()
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn empty_chain_verify_returns_empty() {
        let chain = AuditChain::new();
        assert!(chain.is_empty());
        assert!(matches!(chain.verify(), Err(ChainError::Empty)));
        assert_eq!(chain.head_hash(), GENESIS_PREV_HASH);
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn single_record_chain_verifies() {
        let mut chain = AuditChain::new();
        let rec = chain.append("test", "subject-1", json!({"v": 1}), ts(0));
        assert_eq!(rec.prev_hash, GENESIS_PREV_HASH);
        chain.verify().expect("single-record chain should verify");
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn hundred_record_chain_builds_and_verifies() {
        let mut chain = AuditChain::new();
        for i in 0..100 {
            chain.append("evt", format!("s-{i}"), json!({"i": i}), ts(i as i64));
        }
        assert_eq!(chain.len(), 100);
        chain.verify().expect("100-record chain should verify");
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn tamper_detection_via_payload_mutation() {
        let mut chain = AuditChain::new();
        for i in 0..5 {
            chain.append("evt", "s", json!({"i": i}), ts(i));
        }
        // Mutate record at index 2's payload after the hash was sealed.
        chain.records[2].payload = json!({"i": 999});
        match chain.verify() {
            Err(ChainError::HashMismatch { index, .. }) => assert_eq!(index, 2),
            other => panic!("expected HashMismatch at 2, got {other:?}"),
        }
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn prev_hash_break_detected() {
        let mut chain = AuditChain::new();
        for i in 0..3 {
            chain.append("evt", "s", json!({"i": i}), ts(i));
        }
        // Splice a bogus prev_hash at index 1.
        chain.records[1].prev_hash = "not-the-real-prev".to_string();
        match chain.verify() {
            Err(ChainError::PrevHashBroken { index }) => assert_eq!(index, 1),
            other => panic!("expected PrevHashBroken at 1, got {other:?}"),
        }
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn canonicalization_makes_hash_key_order_independent() {
        let a = json!({"a": 1, "b": 2});
        let b = json!({"b": 2, "a": 1});
        let t = ts(0);
        let ha = AuditRecord::compute_hash("t", "s", &t, GENESIS_PREV_HASH, &a);
        let hb = AuditRecord::compute_hash("t", "s", &t, GENESIS_PREV_HASH, &b);
        assert_eq!(ha, hb);
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn compute_hash_is_deterministic_across_calls() {
        let payload = json!({"nested": {"z": 1, "a": [1, 2, {"y": 9, "x": 8}]}, "k": "v"});
        let t = ts(42);
        let h1 = AuditRecord::compute_hash("type", "subj", &t, "prev", &payload);
        let h2 = AuditRecord::compute_hash("type", "subj", &t, "prev", &payload);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // hex-encoded SHA-256
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn in_memory_store_append_and_head_hash() {
        let store = InMemoryAuditStore::new();
        assert_eq!(store.head_hash().unwrap(), None);

        let mut chain = AuditChain::new();
        let rec = chain.append("t", "s", json!({"x": 1}), ts(0));
        store.append(rec.clone()).expect("append should succeed");

        assert_eq!(store.head_hash().unwrap(), Some(rec.hash.clone()));
        assert!(store.verify_chain().unwrap());

        // Bad prev_hash on a subsequent append is rejected.
        let bogus = AuditRecord {
            id: uuid::Uuid::new_v4(),
            record_type: "t".into(),
            subject_ref: "s".into(),
            occurred_at: ts(1),
            prev_hash: "wrong".into(),
            payload: json!({}),
            hash: "irrelevant".into(),
        };
        assert!(store.append(bogus).is_err());
    }

    // Traces to: FR-STATE-004
    #[test]
    fn append_mutation_builds_record_from_payload() {
        let store = InMemoryAuditStore::new();
        #[derive(serde::Serialize)]
        struct P {
            v: i32,
        }
        let rec = append_mutation(&store, "wallet.grant", "user-1", &P { v: 5 }, ts(0))
            .expect("append_mutation");
        assert_eq!(rec.record_type, "wallet.grant");
        assert_eq!(rec.subject_ref, "user-1");
        assert_eq!(rec.prev_hash, GENESIS_PREV_HASH);
        assert!(store.verify_chain().unwrap());
        assert_eq!(store.head_hash().unwrap(), Some(rec.hash));
    }

    // Traces to: FR-STATE-004
    #[test]
    fn append_mutation_chains_prev_hash() {
        let store = InMemoryAuditStore::new();
        let a = append_mutation(&store, "t", "s", &serde_json::json!({"i": 1}), ts(0)).unwrap();
        let b = append_mutation(&store, "t", "s", &serde_json::json!({"i": 2}), ts(1)).unwrap();
        assert_eq!(b.prev_hash, a.hash);
        assert!(store.verify_chain().unwrap());
    }

    // Traces to: FR-STATE-004
    #[test]
    fn audit_sink_in_memory_appends() {
        let store = InMemoryAuditStore::new();
        let sink: &dyn AuditSink = &store;
        sink.record_mutation(
            "penalty.escalate",
            "user-2",
            serde_json::json!({"tier": "Strict"}),
            ts(5),
        )
        .unwrap();
        assert_eq!(store.chain.lock().unwrap().len(), 1);
    }

    // Traces to: FR-STATE-004
    #[test]
    fn noop_audit_sink_does_nothing_but_succeeds() {
        let sink = NoopAuditSink;
        sink.record_mutation("x", "y", serde_json::json!({}), ts(0)).unwrap();
    }

    // Traces to: FR-STATE-004
    #[test]
    fn capturing_sink_captures_record() {
        let sink = CapturingAuditSink::new();
        sink.record_mutation("policy.built", "user-3", serde_json::json!({"n": 1}), ts(7)).unwrap();
        let snap = sink.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].0, "policy.built");
        assert_eq!(snap[0].1, "user-3");
        assert_eq!(snap[0].2, serde_json::json!({"n": 1}));
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn head_hash_advances_with_each_append() {
        let mut chain = AuditChain::new();
        let r1 = chain.append("t", "s", json!({"i": 1}), ts(1));
        assert_eq!(chain.head_hash(), r1.hash);
        let r2 = chain.append("t", "s", json!({"i": 2}), ts(2));
        assert_eq!(chain.head_hash(), r2.hash);
        assert_eq!(r2.prev_hash, r1.hash);
    }

    // Traces to: FR-STATE-003
    #[test]
    fn wallet_mutations_are_append_only() {
        let store = InMemoryAuditStore::new();
        // Simulate wallet earning 10 credits
        let earn = append_mutation(
            &store,
            "wallet.earn",
            "user-1",
            &serde_json::json!({"credits": 10, "source": "daily_streak"}),
            ts(0),
        )
        .expect("earn mutation");
        assert_eq!(earn.record_type, "wallet.earn");

        // Simulate spending 3 credits
        let spend = append_mutation(
            &store,
            "wallet.spend",
            "user-1",
            &serde_json::json!({"credits": 3, "reason": "unlock_premium"}),
            ts(1),
        )
        .expect("spend mutation");
        assert_eq!(spend.record_type, "wallet.spend");
        assert_eq!(spend.prev_hash, earn.hash);

        // Verify chain integrity — no mutations were lost or reordered
        assert!(store.verify_chain().unwrap());
        assert_eq!(store.chain.lock().unwrap().len(), 2);

        // Verify mutation order is preserved
        let chain = store.chain.lock().unwrap();
        assert_eq!(chain.records[0].record_type, "wallet.earn");
        assert_eq!(chain.records[1].record_type, "wallet.spend");
    }

    // Traces to: FR-STATE-003
    #[test]
    fn penalty_mutations_are_append_only() {
        let store = InMemoryAuditStore::new();
        // Escalate to tier 1
        let _tier1 = append_mutation(
            &store,
            "penalty.escalate",
            "user-2",
            &serde_json::json!({"to_tier": 1, "reason": "threshold_exceeded"}),
            ts(0),
        )
        .expect("escalate to tier 1");

        // Escalate to tier 2
        let tier2 = append_mutation(
            &store,
            "penalty.escalate",
            "user-2",
            &serde_json::json!({"to_tier": 2, "reason": "repeat_violation"}),
            ts(1),
        )
        .expect("escalate to tier 2");

        // Apply lockout
        let _lockout = append_mutation(
            &store,
            "penalty.lockout",
            "user-2",
            &serde_json::json!({"lockout_until": 1700001000}),
            ts(2),
        )
        .expect("lockout");

        // Verify all mutations are in order and chain is sound
        assert!(store.verify_chain().unwrap());
        let chain = store.chain.lock().unwrap();
        assert_eq!(chain.len(), 3);
        assert_eq!(chain.records[0].record_type, "penalty.escalate");
        assert_eq!(chain.records[1].record_type, "penalty.escalate");
        assert_eq!(chain.records[2].record_type, "penalty.lockout");
        assert_eq!(chain.records[2].prev_hash, tier2.hash);
    }
}

