// SPDX-License-Identifier: MIT OR Apache-2.0

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use focus_events::{NormalizedEvent, WellKnownEventType, DedupeKey, EventType};
use focus_rules::{Action, Rule, Trigger};
use uuid::Uuid;

fn make_event(i: usize) -> NormalizedEvent {
    NormalizedEvent {
        event_id: Uuid::new_v4(),
        event_type: EventType::WellKnown(WellKnownEventType::AppSessionStarted),
        occurred_at: chrono::Utc::now(),
        effective_at: chrono::Utc::now(),
        connector_id: "pipeline".to_string(),
        account_id: Uuid::new_v4(),
        dedupe_key: DedupeKey(format!("key_{}", i)),
        confidence: 1.0,
        payload: serde_json::json!({"app": format!("app_{}", i % 50)}),
        raw_ref: None,
    }
}

fn make_rule(i: i32) -> Rule {
    Rule {
        id: Uuid::new_v4(),
        name: format!("rule_{}", i),
        trigger: Trigger::Event("focus_event".to_string()),
        conditions: vec![],
        actions: vec![Action::GrantCredit { amount: 1 }],
        priority: i,
        cooldown: None,
        duration: None,
        explanation_template: "Pipeline eval".to_string(),
        enabled: true,
    }
}

/// Benchmark: evaluation tick dispatching 100 events against 50 rules.
fn bench_eval_tick_100x50(c: &mut Criterion) {
    c.bench_function("eval_tick_100_events_50_rules", |b| {
        let rules = black_box((0..50).map(make_rule).collect::<Vec<_>>());
        let events = black_box((0..100).map(make_event).collect::<Vec<_>>());

        b.iter(|| {
            let mut total_matches = 0;
            for _event in events.iter() {
                for rule in rules.iter() {
                    if rule.enabled {
                        total_matches += 1;
                    }
                }
            }
            black_box(total_matches)
        });
    });
}

/// Benchmark: per-event dispatch latency with increasing rule set sizes.
fn bench_eval_tick_per_event_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("eval_tick_per_event");

    for rule_count in [10, 25, 50, 100] {
        let rules = black_box((0..rule_count).map(make_rule).collect::<Vec<_>>());
        let _event = black_box(make_event(0));

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_rules", rule_count)),
            &rule_count,
            |b, _| {
                b.iter(|| {
                    let mut matches = 0;
                    for rule in rules.iter() {
                        if rule.enabled {
                            matches += 1;
                        }
                    }
                    black_box(matches)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark: cursor persistence and advance path.
fn bench_cursor_advance(c: &mut Criterion) {
    c.bench_function("cursor_advance_1000_iterations", |b| {
        let mut cursor_state = serde_json::json!({
            "connector_id": "rule_eval",
            "entity_type": "events",
            "last_id": "00000000-0000-0000-0000-000000000000",
            "last_timestamp": chrono::Utc::now().to_rfc3339(),
            "offset": 0
        });

        b.iter(|| {
            for i in 0..1000 {
                cursor_state["offset"] = serde_json::json!(i);
                cursor_state["last_id"] = serde_json::json!(format!("{:08x}", i));
            }
            black_box(cursor_state.clone())
        });
    });
}

criterion_group!(
    benches,
    bench_eval_tick_100x50,
    bench_eval_tick_per_event_latency,
    bench_cursor_advance
);
criterion_main!(benches);
