//! L25 (concurrency) — loom permutation test for an OTLP-style metric counter.
//! Run with: RUSTFLAGS="--cfg loom" cargo test --test loom_metric_recorder --release
#![cfg(loom)]
use loom::sync::atomic::{AtomicU64, Ordering};
use loom::sync::Arc;
use loom::thread;

#[test]
fn metric_counter_is_linearizable_under_concurrent_increments() {
    let mut b = loom::model::Builder::new();
    b.preemption_bound = Some(3);
    b.check(|| {
        let counter = Arc::new(AtomicU64::new(0));
        let handles: Vec<_> = (0..2).map(|_| {
            let c = counter.clone();
            thread::spawn(move || { for _ in 0..4 { c.fetch_add(1, Ordering::SeqCst); } })
        }).collect();
        for h in handles { h.join().unwrap(); }
        assert_eq!(counter.load(Ordering::SeqCst), 8);
    });
}
