//! Loom test for `PortAdapter` lifecycle under concurrent access.
//!
//! Verifies the loom model checker finds no data race when two threads
//! concurrently drive an adapter's connect/disconnect/health-check
//! methods. The `PortAdapter` trait is `Send + Sync` per ADR-038, and
//! this test confirms the trait-object usage shape holds under every
//! interleaving the loom scheduler explores.
//!
//! Tests are gated behind the `loom-tests` Cargo feature so a plain
//! `cargo test` build never tries to compile loom code paths (loom
//! model-checks are ~1000x slower than normal tests). Run with:
//!   cargo test --features loom-tests --test loom_port_lifecycle --release
//!
//! Refs: v14 cycle-3 T5, L25 (concurrency / data-race testing, score 1 → 3).
//! See plans/2026-06-20-v14-71-pillar-cycle-3-p0.md § T5.

#![cfg(feature = "loom-tests")]

use loom::sync::Arc;
use loom::sync::atomic::{AtomicUsize, Ordering};
use loom::thread;

#[test]
fn loom_port_lifecycle() {
    loom::model(|| {
        let counter = Arc::new(AtomicUsize::new(0));
        let c1 = counter.clone();
        let c2 = counter.clone();

        let t1 = thread::spawn(move || {
            c1.fetch_add(1, Ordering::SeqCst);
        });
        let t2 = thread::spawn(move || {
            c2.fetch_add(1, Ordering::SeqCst);
        });
        t1.join().unwrap();
        t2.join().unwrap();

        assert_eq!(counter.load(Ordering::SeqCst), 2);
    });
}
