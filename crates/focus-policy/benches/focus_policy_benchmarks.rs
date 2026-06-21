// SPDX-License-Identifier: MIT OR Apache-2.0

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use focus_policy::{EnforcementPolicy, BlockProfile, PolicyBuilder};
use chrono::Utc;
use std::collections::HashMap;

fn policy_builder_creation(c: &mut Criterion) {
    c.bench_function("policy_builder_new", |b| {
        b.iter(|| {
            let _ = black_box(PolicyBuilder::new());
        });
    });
}

fn enforcement_policy_creation(c: &mut Criterion) {
    c.bench_function("enforcement_policy_create", |b| {
        b.iter(|| {
            let policy = EnforcementPolicy {
                id: uuid::Uuid::new_v4(),
                user_id: uuid::Uuid::new_v4(),
                block_profile: BlockProfile {
                    name: "default".into(),
                    categories: vec!["social-media".into()],
                    exceptions: vec![],
                },
                app_targets: vec![],
                scheduled_windows: vec![],
                active: true,
                profile_states: HashMap::new(),
                generated_at: Utc::now(),
            };
            let _ = black_box(policy);
        });
    });
}

fn block_profile_creation(c: &mut Criterion) {
    c.bench_function("block_profile_with_exceptions", |b| {
        b.iter(|| {
            let profile = BlockProfile {
                name: "work".into(),
                categories: (0..10)
                    .map(|i| format!("category-{}", i))
                    .collect::<Vec<_>>(),
                exceptions: (0..5)
                    .map(|i| format!("app-{}", i))
                    .collect::<Vec<_>>(),
            };
            let _ = black_box(profile);
        });
    });
}

criterion_group!(
    benches,
    policy_builder_creation,
    enforcement_policy_creation,
    block_profile_creation
);
criterion_main!(benches);
