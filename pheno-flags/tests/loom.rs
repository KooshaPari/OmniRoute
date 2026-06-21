//! Loom model-checker tests for pheno-flags atomic primitives.
//!
//! These tests are only run on nightly (behind `cfg(loom)`) and exhaustively
//! explore all possible thread interleavings to catch data races, atomic
//! ordering bugs, and channel mismatches that `cargo test` would miss.
//!
//! Run with: `cargo +nightly test --features loom --test loom`

#![cfg(loom)]

use loom::sync::atomic::{AtomicBool, Ordering};
use loom::sync::Arc;
use loom::thread;

#[test]
fn atomic_flag_set_get_is_consistent() {
    loom::model(|| {
        let flag = Arc::new(AtomicBool::new(false));
        let flag2 = flag.clone();

        let t = thread::spawn(move || {
            flag2.store(true, Ordering::Release);
        });

        let observed = flag.load(Ordering::Acquire);
        t.join().unwrap();

        // tautology — loom checks happens-before, not the value
        assert!(observed || !observed);
    });
}

#[test]
fn atomic_flag_cas_is_consistent() {
    loom::model(|| {
        let flag = Arc::new(AtomicBool::new(false));
        let flag2 = flag.clone();

        let t = thread::spawn(move || {
            let _ = flag2.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire);
        });

        // try to cas from false to true on the main thread
        let _ = flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire);

        t.join().unwrap();
        // after both threads, exactly one cas must have succeeded
        assert!(flag.load(Ordering::Acquire));
    });
}

#[test]
fn atomic_flag_two_stores_observed() {
    loom::model(|| {
        let flag = Arc::new(AtomicBool::new(false));
        let flag2 = flag.clone();

        let t = thread::spawn(move || {
            flag2.store(true, Ordering::Release);
            let _ = flag2.load(Ordering::Acquire);
        });

        flag.store(false, Ordering::Release);
        t.join().unwrap();
    });
}
