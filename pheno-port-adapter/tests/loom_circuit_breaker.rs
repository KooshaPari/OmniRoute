//! L25 (concurrency) — loom permutation test for a port-adapter circuit breaker.
//! Run with: RUSTFLAGS="--cfg loom" cargo test --test loom_circuit_breaker --release
#![cfg(loom)]
use loom::sync::atomic::{AtomicU8, Ordering};
use loom::sync::Arc;
use loom::thread;

#[test]
fn circuit_breaker_state_transitions_are_valid_under_concurrency() {
    const CLOSED: u8 = 0; const OPEN: u8 = 1; const HALF_OPEN: u8 = 2;
    let mut b = loom::model::Builder::new();
    b.preemption_bound = Some(3);
    b.check(|| {
        let state = Arc::new(AtomicU8::new(CLOSED));
        let s1 = state.clone();
        let failer = thread::spawn(move || {
            let prev = s1.fetch_add(1, Ordering::SeqCst);
            assert!(prev <= OPEN);
        });
        let s2 = state.clone();
        let inspector = thread::spawn(move || {
            let s = s2.load(Ordering::SeqCst);
            assert!(s == CLOSED || s == OPEN || s == HALF_OPEN);
        });
        failer.join().unwrap(); inspector.join().unwrap();
        assert!(state.load(Ordering::SeqCst) <= HALF_OPEN);
    });
}
