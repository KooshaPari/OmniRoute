//! Integration tests for the [`TimePort`] hexagonal port + the two shipped
//! adapters.
//!
//! Runs under `cargo test --test hex_time` and does **not** require the
//! pre-existing (currently broken) `adapters::tcp` lib-tests to compile, so
//! the time-port slice can be validated in isolation during the v12-06 wave.

use std::time::Instant;

use pheno_port_adapter::{MockClock, SystemClock, TimePort};

#[test]
fn system_clock_now_returns_an_instant() {
    let clock = SystemClock;
    let before = Instant::now();
    let now = clock.now();
    let after = Instant::now();
    // Monotonic: SystemClock::now() should land between the two samples.
    assert!(
        now >= before && now <= after,
        "SystemClock::now() drifted outside the sampled window: before={before:?} now={now:?} after={after:?}"
    );
}

#[test]
fn mock_clock_is_frozen_at_t0() {
    let t0 = Instant::now();
    let clock = MockClock::new(t0);
    // Same value across multiple calls (deterministic).
    assert_eq!(clock.now(), t0);
    assert_eq!(clock.now(), t0);
    assert_eq!(clock.now(), t0);
}

#[test]
fn mock_clock_does_not_advance_with_real_time() {
    let t0 = Instant::now();
    let clock = MockClock::new(t0);
    // Sleep briefly; mock should still return t0 (no real-time advance).
    std::thread::sleep(std::time::Duration::from_millis(2));
    assert_eq!(clock.now(), t0);
}
