// SPDX-License-Identifier: MIT OR Apache-2.0

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use focus_audit::{AuditChain, AuditRecord};
use uuid::Uuid;

/// Benchmark: chain verification throughput over 10k-entry audit log.
/// Verifies all hashes are correctly chained and computes throughput (entries/sec).
/// Target: >10k entries/sec (i.e., <1µs per entry verification)
fn bench_audit_verify_10k_entries(c: &mut Criterion) {
    // Build a 10k-entry chain
    let mut chain = AuditChain::new();
    for i in 0..10_000 {
        let record = AuditRecord {
            id: Uuid::new_v4(),
            record_type: "mutation".to_string(),
            subject_ref: format!("rule_{}", i % 100),
            occurred_at: chrono::Utc::now(),
            prev_hash: if i == 0 {
                focus_audit::GENESIS_PREV_HASH.to_string()
            } else {
                chain.records[i - 1].hash.clone()
            },
            payload: serde_json::json!({
                "action": "credit_grant",
                "amount": i,
                "reason": "benchmark_entry"
            }),
            hash: String::new(), // placeholder
        };

        let recomputed = record.recompute_hash();
        let mut r = record;
        r.hash = recomputed;
        chain.records.push(r);
    }

    let chain = black_box(chain);

    c.bench_function("audit_verify_10k_entries", |b| {
        b.iter(|| {
            let mut verified_count = 0;
            let mut prev_hash = focus_audit::GENESIS_PREV_HASH.to_string();

            for record in chain.records.iter() {
                // Verify hash matches recomputed value
                let recomputed = record.recompute_hash();
                if recomputed == record.hash {
                    verified_count += 1;
                }

                // Verify chain link (current record points to previous)
                if record.prev_hash == prev_hash {
                    verified_count += 1;
                }

                prev_hash = record.hash.clone();
            }

            black_box(verified_count)
        });
    });
}

/// Benchmark: incremental verification of one chain segment.
/// Simulates verifying the last 1000 entries (common case: new entries added).
/// Target: <10ms
fn bench_audit_verify_incremental_1k(c: &mut Criterion) {
    let mut chain = AuditChain::new();
    for i in 0..10_000 {
        let record = AuditRecord {
            id: Uuid::new_v4(),
            record_type: "mutation".to_string(),
            subject_ref: format!("rule_{}", i % 100),
            occurred_at: chrono::Utc::now(),
            prev_hash: if i == 0 {
                focus_audit::GENESIS_PREV_HASH.to_string()
            } else {
                chain.records[i - 1].hash.clone()
            },
            payload: serde_json::json!({"action": "update"}),
            hash: String::new(),
        };

        let recomputed = record.recompute_hash();
        let mut r = record;
        r.hash = recomputed;
        chain.records.push(r);
    }

    let chain = black_box(chain);
    let base_hash = chain.records[9_000 - 1].hash.clone();

    c.bench_function("audit_verify_incremental_1k", |b| {
        b.iter(|| {
            let mut verified_count = 0;
            let mut prev_hash = base_hash.clone();

            // Verify tail 1000 entries
            for record in chain.records[9_000..].iter() {
                let recomputed = record.recompute_hash();
                if recomputed == record.hash && record.prev_hash == prev_hash {
                    verified_count += 1;
                }
                prev_hash = record.hash.clone();
            }

            black_box(verified_count)
        });
    });
}

criterion_group!(
    benches,
    bench_audit_verify_10k_entries,
    bench_audit_verify_incremental_1k
);
criterion_main!(benches);
