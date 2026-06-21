// SPDX-License-Identifier: MIT OR Apache-2.0

//! Integration tests for focus-storage SQLite adapter.
//!
//! Traces to: FR-DATA-001, FR-DATA-002.

use chrono::{Duration, TimeZone, Utc};
use focus_events::{DedupeKey, EventType, NormalizedEvent, WellKnownEventType};
use focus_penalties::{EscalationTier, PenaltyMutation};
use focus_rewards::{Credit, WalletMutation};
use focus_rules::{Action, Condition, Rule, Trigger};
use focus_storage::ports::{EventStore, PenaltyStore, RuleStore, WalletStore};
use focus_storage::sqlite::event_store::get_by_id;
use focus_storage::sqlite::rule_store::upsert_rule;
use focus_storage::SqliteAdapter;
use serde_json::json;
use uuid::Uuid;

fn mk_event(seed: u8, dedupe: &str, et: EventType) -> NormalizedEvent {
    // Deterministic uuid from seed for ordering.
    let mut bytes = [0u8; 16];
    bytes[0] = seed;
    NormalizedEvent {
        event_id: Uuid::from_bytes(bytes),
        connector_id: "canvas".into(),
        account_id: Uuid::nil(),
        event_type: et,
        occurred_at: Utc.with_ymd_and_hms(2026, 1, 1, seed as u32 % 24, 0, 0).unwrap(),
        effective_at: Utc.with_ymd_and_hms(2026, 1, 1, seed as u32 % 24, 0, 0).unwrap(),
        dedupe_key: DedupeKey(dedupe.to_string()),
        confidence: 1.0,
        payload: json!({"seed": seed}),
        raw_ref: None,
    }
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn open_in_memory_succeeds() {
    let _adapter = SqliteAdapter::open_in_memory().expect("open");
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn open_on_disk_and_reopen() {
    let dir = tempdir_path("focus-storage-reopen");
    std::fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("focus.db");
    {
        let a = SqliteAdapter::open(&db_path).expect("open");
        let ev = mk_event(1, "ddk-1", EventType::WellKnown(WellKnownEventType::TaskCompleted));
        a.append(ev).await.expect("append");
    }
    // reopen and confirm the event persists
    let a = SqliteAdapter::open(&db_path).expect("reopen");
    let events = a.since_cursor(None, 10).await.expect("since");
    assert_eq!(events.len(), 1);
    let _ = std::fs::remove_dir_all(&dir);
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn migration_idempotent_via_open() {
    let dir = tempdir_path("focus-storage-migr");
    std::fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("focus.db");
    let _ = SqliteAdapter::open(&db_path).expect("open 1");
    let _ = SqliteAdapter::open(&db_path).expect("open 2");
    let _ = std::fs::remove_dir_all(&dir);
}

// Traces to: FR-DATA-002 (dedupe)
#[tokio::test]
async fn event_dedupe_is_no_op() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let ev1 = mk_event(1, "ddk-dupe", EventType::WellKnown(WellKnownEventType::TaskCompleted));
    let ev2_same_key = NormalizedEvent { event_id: Uuid::from_bytes([2; 16]), ..ev1.clone() };
    a.append(ev1.clone()).await.unwrap();
    a.append(ev2_same_key).await.unwrap();
    let events = a.since_cursor(None, 10).await.unwrap();
    assert_eq!(events.len(), 1, "second event with same dedupe_key must be ignored");
    assert_eq!(events[0].event_id, ev1.event_id);
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn cursor_pagination_returns_events_after_cursor() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    for i in 1..=5u8 {
        a.append(mk_event(
            i,
            &format!("k-{i}"),
            EventType::WellKnown(WellKnownEventType::TaskCompleted),
        ))
        .await
        .unwrap();
    }
    let first = a.since_cursor(None, 2).await.unwrap();
    assert_eq!(first.len(), 2);
    let cursor = first.last().unwrap().event_id.to_string();
    let next = a.since_cursor(Some(&cursor), 10).await.unwrap();
    assert!(next.iter().all(|e| e.event_id.to_string() > cursor));
    assert_eq!(first.len() + next.len(), 5);
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn event_roundtrip_preserves_fields() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let ev = mk_event(7, "ddk-rt", EventType::WellKnown(WellKnownEventType::AppSessionStarted));
    a.append(ev.clone()).await.unwrap();
    let fetched = get_by_id(&a, ev.event_id).await.unwrap().expect("present");
    assert_eq!(fetched.event_id, ev.event_id);
    assert_eq!(fetched.connector_id, ev.connector_id);
    assert_eq!(fetched.dedupe_key, ev.dedupe_key);
    assert_eq!(fetched.payload, ev.payload);
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn rule_roundtrip_get_and_list_enabled() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let enabled = Rule {
        id: Uuid::new_v4(),
        name: "grant-on-task".into(),
        trigger: Trigger::Event("TaskCompleted".into()),
        conditions: vec![Condition { kind: "confidence_gte".into(), params: json!({"min": 0.5}) }],
        actions: vec![Action::GrantCredit { amount: 10 }],
        priority: 5,
        cooldown: Some(Duration::minutes(30)),
        duration: None,
        explanation_template: "{rule_name}".into(),
        enabled: true,
    };
    let disabled = Rule { id: Uuid::new_v4(), enabled: false, ..enabled.clone() };
    upsert_rule(&a, enabled.clone()).await.unwrap();
    upsert_rule(&a, disabled.clone()).await.unwrap();

    let got = a.get(enabled.id).await.unwrap().expect("rule present");
    assert_eq!(got.name, "grant-on-task");
    assert_eq!(got.priority, 5);
    assert_eq!(got.cooldown, Some(Duration::minutes(30)));
    assert_eq!(got.conditions.len(), 1);
    assert_eq!(got.actions, vec![Action::GrantCredit { amount: 10 }]);

    let list = a.list_enabled().await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, enabled.id);
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn rule_get_missing_returns_none() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    assert!(a.get(Uuid::new_v4()).await.unwrap().is_none());
}

// Traces to: FR-DATA-001, FR-STATE-001
#[tokio::test]
async fn wallet_roundtrip_grant_spend_streak() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let uid = Uuid::new_v4();

    let fresh = WalletStore::load(&a, uid).await.unwrap();
    assert_eq!(fresh.balance(), 0);

    WalletStore::apply(
        &a,
        uid,
        WalletMutation::GrantCredit(Credit {
            amount: 100,
            source_rule_id: None,
            granted_at: Utc::now(),
        }),
    )
    .await
    .unwrap();
    WalletStore::apply(
        &a,
        uid,
        WalletMutation::SpendCredit { amount: 40, purpose: "unlock".into() },
    )
    .await
    .unwrap();
    WalletStore::apply(&a, uid, WalletMutation::StreakIncrement("daily".into())).await.unwrap();

    let w = WalletStore::load(&a, uid).await.unwrap();
    assert_eq!(w.earned_credits, 100);
    assert_eq!(w.spent_credits, 40);
    assert_eq!(w.balance(), 60);
    assert_eq!(w.streaks.get("daily").map(|s| s.count), Some(1));
}

// Traces to: FR-DATA-001, FR-STATE-001
#[tokio::test]
async fn wallet_insufficient_credit_rejected() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let uid = Uuid::new_v4();
    let err =
        WalletStore::apply(&a, uid, WalletMutation::SpendCredit { amount: 5, purpose: "x".into() })
            .await
            .unwrap_err();
    assert!(format!("{err}").contains("wallet mutation"));
    let w = WalletStore::load(&a, uid).await.unwrap();
    assert_eq!(w.balance(), 0);
}

// Traces to: FR-DATA-001, FR-STATE-002
#[tokio::test]
async fn penalty_roundtrip_escalate_and_bypass() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let uid = Uuid::new_v4();

    PenaltyStore::apply(&a, uid, PenaltyMutation::Escalate(EscalationTier::Warning)).await.unwrap();
    PenaltyStore::apply(&a, uid, PenaltyMutation::GrantBypass(10)).await.unwrap();
    PenaltyStore::apply(&a, uid, PenaltyMutation::SpendBypass(3)).await.unwrap();

    let s = PenaltyStore::load(&a, uid).await.unwrap();
    assert_eq!(s.escalation_tier, EscalationTier::Warning);
    assert_eq!(s.bypass_budget, 7);
}

// Traces to: FR-DATA-001, FR-STATE-002
#[tokio::test]
async fn penalty_escalation_down_is_rejected() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let uid = Uuid::new_v4();
    PenaltyStore::apply(&a, uid, PenaltyMutation::Escalate(EscalationTier::Restricted))
        .await
        .unwrap();
    let err = PenaltyStore::apply(&a, uid, PenaltyMutation::Escalate(EscalationTier::Warning))
        .await
        .unwrap_err();
    assert!(format!("{err}").contains("penalty mutation"));
    let s = PenaltyStore::load(&a, uid).await.unwrap();
    assert_eq!(s.escalation_tier, EscalationTier::Restricted);
}

// Traces to: FR-DATA-001
#[tokio::test]
async fn penalty_load_default_for_unknown_user() {
    let a = SqliteAdapter::open_in_memory().unwrap();
    let uid = Uuid::new_v4();
    let s = PenaltyStore::load(&a, uid).await.unwrap();
    assert_eq!(s.escalation_tier, EscalationTier::Clear);
    assert_eq!(s.bypass_budget, 0);
    assert!(s.lockout_windows.is_empty());
}

// --- helpers ---------------------------------------------------------------

fn tempdir_path(tag: &str) -> std::path::PathBuf {
    let mut p = std::env::temp_dir();
    let nonce = Uuid::new_v4();
    p.push(format!("{tag}-{nonce}"));
    p
}
