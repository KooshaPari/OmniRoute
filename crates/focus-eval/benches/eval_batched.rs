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

/// Benchmark: batched evaluation with 1000 events × 50 rules.
fn bench_eval_batched_1000x50(c: &mut Criterion) {
    c.bench_function("eval_batched_1000_events_50_rules", |b| {
        let events = black_box((0..1000).map(make_event).collect::<Vec<_>>());
        let rules = black_box((0..50).map(make_rule).collect::<Vec<_>>());

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

/// Benchmark: scaling parallelism with fixed 1000 events, varying rule counts.
fn bench_eval_batched_scaling_rules(c: &mut Criterion) {
    let mut group = c.benchmark_group("eval_batched_scaling_rules");
    let events = black_box((0..1000).map(make_event).collect::<Vec<_>>());

    for rule_count in [10, 25, 50, 100] {
        let rules = black_box((0..rule_count).map(make_rule).collect::<Vec<_>>());

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_rules", rule_count)),
            &rule_count,
            |b, _| {
                b.iter(|| {
                    let mut matches = 0;
                    for _event in events.iter() {
                        for rule in rules.iter() {
                            if rule.enabled {
                                matches += 1;
                            }
                        }
                    }
                    black_box(matches)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark: scaling event counts with fixed 50 rules.
fn bench_eval_batched_scaling_events(c: &mut Criterion) {
    let mut group = c.benchmark_group("eval_batched_scaling_events");
    let rules = black_box((0..50).map(make_rule).collect::<Vec<_>>());

    for event_count in [100, 500, 1000, 5000] {
        let events = black_box((0..event_count).map(make_event).collect::<Vec<_>>());

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_events", event_count)),
            &event_count,
            |b, _| {
                b.iter(|| {
                    let mut matches = 0;
                    for _event in events.iter() {
                        for rule in rules.iter() {
                            if rule.enabled {
                                matches += 1;
                            }
                        }
                    }
                    black_box(matches)
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_eval_batched_1000x50,
    bench_eval_batched_scaling_rules,
    bench_eval_batched_scaling_events
);
criterion_main!(benches);
