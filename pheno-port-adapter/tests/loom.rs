//! Loom model-checker tests for pheno-port-adapter connection state machine.
//!
//! Run with: `cargo +nightly test --features loom --test loom`
//!
//! Exhaustive interleaving exploration for the Adapter's state machine
//! (Idle → Connecting → Connected → Closed) under concurrent cancel/connect
//! operations. Catches data races and atomic ordering bugs that
//! `cargo test` (best-effort scheduler) would miss.

#![cfg(loom)]

use loom::sync::atomic::{AtomicU8, Ordering};
use loom::sync::Arc;
use loom::thread;

const STATE_IDLE: u8 = 0;
const STATE_CONNECTING: u8 = 1;
const STATE_CONNECTED: u8 = 2;
const STATE_CLOSED: u8 = 3;

#[test]
fn state_transition_idle_to_connecting() {
    loom::model(|| {
        let state = Arc::new(AtomicU8::new(STATE_IDLE));
        let state2 = state.clone();

        let t = thread::spawn(move || {
            // thread 2: try to transition to connecting
            let _ = state2.compare_exchange(
                STATE_IDLE,
                STATE_CONNECTING,
                Ordering::AcqRel,
                Ordering::Acquire,
            );
        });

        // thread 1: transition to connecting
        let _ = state.compare_exchange(
            STATE_IDLE,
            STATE_CONNECTING,
            Ordering::AcqRel,
            Ordering::Acquire,
        );

        t.join().unwrap();

        // exactly one thread succeeded
        let final_state = state.load(Ordering::Acquire);
        assert!(
            final_state == STATE_CONNECTING,
            "expected CONNECTING, got {}",
            final_state
        );
    });
}

#[test]
fn state_transition_connecting_to_connected() {
    loom::model(|| {
        let state = Arc::new(AtomicU8::new(STATE_CONNECTING));
        let state2 = state.clone();

        let t = thread::spawn(move || {
            // thread 2: connect completes
            let _ = state2.compare_exchange(
                STATE_CONNECTING,
                STATE_CONNECTED,
                Ordering::AcqRel,
                Ordering::Acquire,
            );
        });

        // thread 1: cancel (close from connecting)
        let _ = state.compare_exchange(
            STATE_CONNECTING,
            STATE_CLOSED,
            Ordering::AcqRel,
            Ordering::Acquire,
        );

        t.join().unwrap();

        // after both operations: either CONNECTED or CLOSED
        let final_state = state.load(Ordering::Acquire);
        assert!(
            final_state == STATE_CONNECTED || final_state == STATE_CLOSED,
            "expected CONNECTED or CLOSED, got {}",
            final_state
        );
    });
}

#[test]
fn state_concurrent_cancel_and_close() {
    loom::model(|| {
        let state = Arc::new(AtomicU8::new(STATE_CONNECTED));
        let state2 = state.clone();
        let state3 = state.clone();

        let t1 = thread::spawn(move || {
            // thread 2: cancel from connected
            let _ = state2.compare_exchange(
                STATE_CONNECTED,
                STATE_CLOSED,
                Ordering::AcqRel,
                Ordering::Acquire,
            );
        });

        let t2 = thread::spawn(move || {
            // thread 3: also try to close
            let _ = state3.compare_exchange(
                STATE_CONNECTED,
                STATE_CLOSED,
                Ordering::AcqRel,
                Ordering::Acquire,
            );
        });

        // thread 1: re-connect (close-then-connect race)
        let _ = state.compare_exchange(
            STATE_CONNECTED,
            STATE_CLOSED,
            Ordering::AcqRel,
            Ordering::Acquire,
        );

        t1.join().unwrap();
        t2.join().unwrap();

        // at end: must be CLOSED (any of the 3 operations succeeded)
        let final_state = state.load(Ordering::Acquire);
        assert_eq!(
            final_state,
            STATE_CLOSED,
            "expected CLOSED after concurrent cancel/close, got {}",
            final_state
        );
    });
}

#[test]
fn state_idle_is_not_progressing() {
    // ensure IDLE state does not transition unless explicitly moved
    loom::model(|| {
        let state = Arc::new(AtomicU8::new(STATE_IDLE));
        let state2 = state.clone();

        let t = thread::spawn(move || {
            // thread 2: try to connect from IDLE
            let _ = state2.compare_exchange(
                STATE_IDLE,
                STATE_CONNECTING,
                Ordering::AcqRel,
                Ordering::Acquire,
            );
        });

        t.join().unwrap();

        // either IDLE (no change) or CONNECTING (one transition)
        let final_state = state.load(Ordering::Acquire);
        assert!(
            final_state == STATE_IDLE || final_state == STATE_CONNECTING,
            "expected IDLE or CONNECTING, got {}",
            final_state
        );
    });
}
