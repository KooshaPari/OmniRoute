// SPDX-License-Identifier: MIT OR Apache-2.0

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use sha2::{Digest, Sha256};

/// Benchmark: content hash of a small typical RuleIr document.
/// Target: <10µs
fn bench_content_hash_small_document(c: &mut Criterion) {
    let small_doc = black_box(
        serde_json::json!({
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "app_focus_rule",
            "trigger": {
                "kind": "event",
                "params": {"event_type": "app_focus"}
            },
            "conditions": [
                {
                    "kind": "payload_contains",
                    "params": {"key": "app_name", "value": "com.example.app"}
                }
            ],
            "actions": [
                {
                    "kind": "grant_credit",
                    "params": {"amount": 10, "reason": "focus_session"}
                }
            ],
            "metadata": {
                "priority": 10,
                "cooldown_secs": 60,
                "created_at": "2026-04-23T00:00:00Z"
            }
        })
        .to_string()
    );

    c.bench_function("content_hash_small_document", |b| {
        b.iter(|| {
            let mut hasher = Sha256::new();
            hasher.update(small_doc.as_bytes());
            let _hash = hasher.finalize();
            black_box(_hash)
        });
    });
}

/// Benchmark: content hash of a 1000-rule synthesized IR document.
/// Target: <5ms
fn bench_content_hash_1000_rule_document(c: &mut Criterion) {
    // Build a synthetic 1000-rule document
    let mut rules = vec![];
    for i in 0..1000 {
        rules.push(serde_json::json!({
            "id": format!("550e8400-e29b-41d4-a716-44665544{:04x}", i),
            "name": format!("rule_{}", i),
            "trigger": {
                "kind": "event",
                "params": {"event_type": "app_event"}
            },
            "conditions": [],
            "actions": [{"kind": "grant_credit", "params": {"amount": 1}}],
            "metadata": {"priority": i, "cooldown_secs": 30}
        }));
    }

    let document = black_box(
        serde_json::json!({
            "version": "1.0",
            "namespace": "focus.rules.ir",
            "rules": rules
        })
        .to_string()
    );

    c.bench_function("content_hash_1000_rule_document", |b| {
        b.iter(|| {
            let mut hasher = Sha256::new();
            hasher.update(document.as_bytes());
            let _hash = hasher.finalize();
            black_box(_hash)
        });
    });
}

criterion_group!(
    benches,
    bench_content_hash_small_document,
    bench_content_hash_1000_rule_document
);
criterion_main!(benches);
