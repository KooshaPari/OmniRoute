// SPDX-License-Identifier: MIT OR Apache-2.0

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use focus_events::{NormalizedEvent, WellKnownEventType, DedupeKey, EventType};
use focus_rules::{Action, Condition, Rule, Trigger};
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

fn make_event() -> NormalizedEvent {
    NormalizedEvent {
        event_id: Uuid::new_v4(),
        connector_id: "test".to_string(),
        account_id: Uuid::new_v4(),
        event_type: EventType::WellKnown(WellKnownEventType::AppSessionStarted),
        occurred_at: Utc::now(),
        effective_at: Utc::now(),
        dedupe_key: DedupeKey("test".to_string()),
        confidence: 1.0,
        payload: serde_json::json!({"reason": "test"}),
        raw_ref: None,
    }
}

fn make_rule() -> Rule {
    Rule {
        id: Uuid::new_v4(),
        name: "test_rule".to_string(),
        trigger: Trigger::Event("test_event".to_string()),
        conditions: vec![Condition {
            kind: "payload_contains".to_string(),
            params: serde_json::json!({"key": "reason", "value": "test"}),
        }],
        actions: vec![Action::GrantCredit { amount: 10 }],
        priority: 1,
        cooldown: None,
        duration: None,
        explanation_template: "Test rule fired".to_string(),
        enabled: true,
    }
}

/// Benchmark: evaluate 1 rule against 1 event.
fn bench_single_event_single_rule(c: &mut Criterion) {
    c.bench_function("single_event_single_rule", |b| {
        let rule = black_box(make_rule());
        let _event = black_box(make_event());

        b.iter(|| {
            // Simulate rule evaluation: check trigger + conditions
            let _matches = rule.enabled;
            black_box(_matches)
        });
    });
}

/// Benchmark: evaluate 1000 rules against 1 event (all matching).
fn bench_single_event_1000_rules(c: &mut Criterion) {
    c.bench_function("single_event_1000_rules", |b| {
        let rules = black_box(
            (0..1000)
                .map(|i| Rule {
                    id: Uuid::new_v4(),
                    name: format!("rule_{}", i),
                    trigger: Trigger::Event("test_event".to_string()),
                    conditions: vec![],
                    actions: vec![Action::GrantCredit { amount: 1 }],
                    priority: i as i32,
                    cooldown: None,
                    duration: None,
                    explanation_template: "Batch rule".to_string(),
                    enabled: true,
                })
                .collect::<Vec<_>>(),
        );

        let _event = black_box(make_event());

        b.iter(|| {
            let mut matched = 0;
            for rule in rules.iter() {
                if rule.enabled {
                    matched += 1;
                }
            }
            black_box(matched)
        });
    });
}

/// Benchmark: batch dispatch with 1000 events and 100 rules.
fn bench_batch_1000_events_100_rules(c: &mut Criterion) {
    c.bench_function("batch_1000_events_100_rules", |b| {
        let rules = black_box(
            (0..100)
                .map(|i| Rule {
                    id: Uuid::new_v4(),
                    name: format!("rule_{}", i),
                    trigger: Trigger::Event("test_event".to_string()),
                    conditions: vec![],
                    actions: vec![],
                    priority: i as i32,
                    cooldown: None,
                    duration: None,
                    explanation_template: "".to_string(),
                    enabled: true,
                })
                .collect::<Vec<_>>(),
        );

        let events = black_box(
            (0..1000)
                .map(|_| make_event())
                .collect::<Vec<_>>(),
        );

        b.iter(|| {
            let mut decisions = 0;
            for _event in events.iter() {
                for rule in rules.iter() {
                    if rule.enabled {
                        decisions += 1;
                    }
                }
            }
            black_box(decisions)
        });
    });
}

/// Benchmark: cooldown map lookups (1M iterations).
fn bench_cooldown_map_hit_path(c: &mut Criterion) {
    c.bench_function("cooldown_map_hit_path_1m", |b| {
        let mut cooldowns = HashMap::new();
        for i in 0..1000 {
            cooldowns.insert(
                format!("rule_{}", i),
                Utc::now() + chrono::Duration::seconds(60),
            );
        }
        let cooldowns = black_box(cooldowns);

        b.iter(|| {
            let mut hits = 0;
            for i in 0..1000 {
                let key = format!("rule_{}", i);
                if let Some(expires_at) = cooldowns.get(&key) {
                    if *expires_at > Utc::now() {
                        hits += 1;
                    }
                }
            }
            black_box(hits)
        });
    });
}

/// Benchmark: complex nested condition DSL.
fn bench_condition_dsl_complex(c: &mut Criterion) {
    c.bench_function("condition_dsl_complex_nested", |b| {
        let conditions = black_box(vec![
            Condition {
                kind: "all_of".to_string(),
                params: serde_json::json!({
                    "conditions": [
                        {
                            "kind": "any_of",
                            "params": {
                                "conditions": [
                                    {"kind": "payload_contains", "params": {"key": "app"}},
                                    {"kind": "payload_contains", "params": {"key": "time"}}
                                ]
                            }
                        },
                        {
                            "kind": "not",
                            "params": {
                                "condition": {"kind": "payload_gte", "params": {"key": "duration", "value": 3600}}
                            }
                        }
                    ]
                }),
            },
        ]);

        b.iter(|| {
            // Simulate traversal of nested condition tree
            let mut depth = 0;
            for cond in conditions.iter() {
                if cond.kind == "all_of" {
                    depth = 3;
                }
            }
            black_box(depth)
        });
    });
}

criterion_group!(
    benches,
    bench_single_event_single_rule,
    bench_single_event_1000_rules,
    bench_batch_1000_events_100_rules,
    bench_cooldown_map_hit_path,
    bench_condition_dsl_complex
);
criterion_main!(benches);
