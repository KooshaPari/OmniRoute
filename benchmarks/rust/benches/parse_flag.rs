// benchmarks/rust/benches/parse_flag.rs — v12 T9 L57 perf regression (Rust)
// Parses 1,000 mock flag strings and reports ns/iter.

use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn parse_one(input: &str) -> (&str, Option<&str>) {
    // Minimal: split on '=' into (key, value) where value is optional.
    if let Some(idx) = input.find('=') {
        (&input[..idx], Some(&input[idx + 1..]))
    } else {
        (input, None)
    }
}

fn bench_parse_1000(c: &mut Criterion) {
    let sample: String = (0..1000)
        .map(|i| if i % 2 == 0 { format!("flag_{i}=value_{i}") } else { format!("flag_{i}") })
        .collect::<Vec<_>>()
        .join(" ");

    c.bench_function("parse_flag_x1000", |b| {
        b.iter(|| {
            for tok in black_box(&sample).split_whitespace() {
                let _ = parse_one(tok);
            }
        })
    });
}

criterion_group!(benches, bench_parse_1000);
criterion_main!(benches);
