// SPDX-License-Identifier: MIT OR Apache-2.0

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use secrecy::SecretString;

fn keychain_initialization(c: &mut Criterion) {
    c.bench_function("secure_store_create", |b| {
        b.iter(|| {
            let _ = black_box(focus_crypto::NullSecureStore);
        });
    });
}

fn secret_string_creation_small(c: &mut Criterion) {
    c.bench_function("secret_string_small_32b", |b| {
        let input = black_box("test-secret-key-32-bytes-long!");
        b.iter(|| {
            let _ = SecretString::new(input.to_string().into());
        });
    });
}

fn secret_string_creation_large(c: &mut Criterion) {
    c.bench_function("secret_string_large_1kb", |b| {
        let input = black_box("x".repeat(1024));
        b.iter(|| {
            let _ = SecretString::new(input.clone().into());
        });
    });
}

criterion_group!(
    benches,
    keychain_initialization,
    secret_string_creation_small,
    secret_string_creation_large
);
criterion_main!(benches);
