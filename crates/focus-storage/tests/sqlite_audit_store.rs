// SPDX-License-Identifier: MIT OR Apache-2.0

//! Integration tests for `SqliteAuditStore`.
//!
//! Traces to: FR-STATE-004, FR-DATA-002.

use focus_audit::{append_mutation, AuditRecord, AuditSink, GENESIS_PREV_HASH};
use focus_storage::sqlite::audit_store::SqliteAuditStore;
use focus_storage::SqliteAdapter;
use serde_json::json;

fn mk_store() -> SqliteAuditStore {
    let adapter = SqliteAdapter::open_in_memory().expect("adapter");
    SqliteAuditStore::from_adapter(&adapter)
}

// Traces to: FR-STATE-004
#[tokio::test(flavor = "multi_thread")]
async fn append_and_head_hash_roundtrip() {
    let store = mk_store();
    assert_eq!(store.head_hash_async().await.unwrap(), None);
    let rec =
        append_mutation(&store, "wallet.grant", "user-1", &json!({"v": 1}), chrono::Utc::now())
            .expect("append_mutation");
    assert_eq!(rec.prev_hash, GENESIS_PREV_HASH);
    assert_eq!(store.head_hash_async().await.unwrap(), Some(rec.hash));
}

// Traces to: FR-STATE-004
#[tokio::test(flavor = "multi_thread")]
async fn load_all_returns_insertion_order() {
    let store = mk_store();
    for i in 0..5 {
        append_mutation(
            &store,
            "t",
            &format!("s-{i}"),
            &json!({"i": i}),
            chrono::DateTime::from_timestamp(1_700_000_000 + i, 0).unwrap(),
        )
        .unwrap();
    }
    let all = store.load_all().await.unwrap();
    assert_eq!(all.len(), 5);
    for (i, rec) in all.iter().enumerate() {
        assert_eq!(rec.subject_ref, format!("s-{i}"));
    }
}

// Traces to: FR-STATE-004, FR-DATA-002
#[tokio::test(flavor = "multi_thread")]
async fn verify_chain_holds_for_clean_chain() {
    let store = mk_store();
    for i in 0..10 {
        append_mutation(
            &store,
            "t",
            "s",
            &json!({"i": i}),
            chrono::DateTime::from_timestamp(1_700_000_000 + i, 0).unwrap(),
        )
        .unwrap();
    }
    assert!(store.verify_chain_async().await.unwrap());
}

// Traces to: FR-STATE-004, FR-DATA-002
#[tokio::test(flavor = "multi_thread")]
async fn verify_chain_detects_tampered_payload() {
    let store = mk_store();
    for i in 0..3 {
        append_mutation(
            &store,
            "t",
            "s",
            &json!({"i": i}),
            chrono::DateTime::from_timestamp(1_700_000_000 + i, 0).unwrap(),
        )
        .unwrap();
    }
    // Mutate row-2's payload directly, bypassing the chain's hash logic.
    store.__test_tamper_payload(2, json!({"i": 999})).await.unwrap();
    assert!(!store.verify_chain_async().await.unwrap(), "chain verify must fail after row tamper");
}

// Traces to: FR-STATE-004
#[tokio::test(flavor = "multi_thread")]
async fn append_rejects_bad_prev_hash() {
    let store = mk_store();
    let bad = AuditRecord {
        id: uuid::Uuid::new_v4(),
        record_type: "t".into(),
        subject_ref: "s".into(),
        occurred_at: chrono::Utc::now(),
        prev_hash: "not-genesis".into(),
        payload: json!({}),
        hash: "irrelevant".into(),
    };
    assert!(store.append_async(bad).await.is_err());
}

// Traces to: FR-STATE-004
#[tokio::test(flavor = "multi_thread")]
async fn audit_sink_record_mutation_writes_row() {
    let store = mk_store();
    let sink: &dyn AuditSink = &store;
    sink.record_mutation(
        "penalty.escalate",
        "user-xyz",
        json!({"tier": "Strict"}),
        chrono::Utc::now(),
    )
    .unwrap();
    let all = store.load_all().await.unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].record_type, "penalty.escalate");
    assert_eq!(all[0].subject_ref, "user-xyz");
    assert_eq!(all[0].payload["tier"], "Strict");
}

// Traces to: FR-STATE-004, FR-DATA-002
#[tokio::test(flavor = "multi_thread")]
async fn persistence_across_reopen() {
    let dir = std::env::temp_dir().join(format!("focus-audit-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("focus.db");
    let hash_after_write = {
        let adapter = SqliteAdapter::open(&path).expect("open1");
        let store = SqliteAuditStore::from_adapter(&adapter);
        let rec =
            append_mutation(&store, "policy.built", "subj", &json!({"x": 1}), chrono::Utc::now())
                .unwrap();
        rec.hash
    };
    let adapter2 = SqliteAdapter::open(&path).expect("open2");
    let store2 = SqliteAuditStore::from_adapter(&adapter2);
    assert_eq!(store2.head_hash_async().await.unwrap(), Some(hash_after_write));
    let _ = std::fs::remove_dir_all(&dir);
}
