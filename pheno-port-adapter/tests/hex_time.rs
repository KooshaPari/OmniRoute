//! Smoke test for the [`HexTimePort`] trait + clock adapters.
//!
//! This test file is the `tests/hex_time.rs` companion to
//! `tests/hex_cache.rs` — every hex port in `pheno-port-adapter` ships
//! a smoke test in this directory.
//!
//! What it covers:
//! - Trait object-safety round-trip via `Arc<dyn HexTimePort>`.
//! - `SystemClock` advances in real time.
//! - `MockClock::from_seconds` round-trips and `advance` keeps
//!   `now()` and `unix_nanos()` in lockstep.
//! - `MockClock::Clone` shares state across clones.
//! - `SystemClock` and `MockClock` are interchangeable behind the
//!   trait (the whole point of the port).
//!
//! [`HexTimePort`]: pheno_port_adapter::HexTimePort

use std::sync::Arc;
use std::time::Duration;

use pheno_port_adapter::adapters::{MockClock, SystemClock};
use pheno_port_adapter::HexTimePort;

#[test]
fn system_clock_advances_with_real_time() {
    let clock = SystemClock::new();
    let start = clock.now();
    std::thread::sleep(Duration::from_millis(20));
    let elapsed = clock.now() - start;
    assert!(
        elapsed >= Duration::from_millis(15),
        "expected at least 15ms of real elapsed time, got {elapsed:?}"
    );
}

#[test]
fn mock_clock_from_seconds_round_trips() {
    // from_seconds takes any unsigned integer; 7u64 → 7 * 1e9 nanos.
    let clock = MockClock::from_seconds(7u64);
    assert_eq!(clock.unix_nanos(), 7_000_000_000);
}

#[test]
fn mock_clock_from_seconds_accepts_unsigned_integers() {
    // Convenience for the most common test pattern: pin wall-clock
    // to a known fixture time without conversion noise.
    let a = MockClock::from_seconds(42u32);
    let b = MockClock::from_seconds(42u64);
    assert_eq!(a.unix_nanos(), b.unix_nanos());
    assert_eq!(a.unix_nanos(), 42 * 1_000_000_000);
}

#[test]
fn mock_clock_advance_keeps_now_and_unix_nanos_in_lockstep() {
    let clock = MockClock::from_seconds(0u32);
    let baseline_now = clock.now();
    let baseline_unix = clock.unix_nanos();

    clock.advance(Duration::from_millis(250));

    let now_delta = clock.now() - baseline_now;
    let unix_delta = clock.unix_nanos() - baseline_unix;

    assert!(now_delta >= Duration::from_millis(200));
    // 250ms = 250_000_000 nanos; allow ±1ms slack.
    assert!(
        (249_000_000..=251_000_000).contains(&unix_delta),
        "unix_nanos delta {unix_delta} outside expected 250ms band"
    );
}

#[test]
fn mock_clock_clones_share_state() {
    let a = MockClock::from_seconds(0u32);
    let b = a.clone();
    a.advance(Duration::from_secs(1));
    assert_eq!(b.unix_nanos(), 1_000_000_000);
    assert_eq!(b.offset_secs(), 1.0);
}

#[test]
fn mock_clock_set_offset_rewinds_elapsed_time() {
    let clock = MockClock::from_seconds(0u32);
    clock.set_offset(Duration::from_secs(42));
    let baseline = clock.now();
    std::thread::sleep(Duration::from_millis(5));
    let elapsed = clock.now() - baseline;
    // Baseline is captured AFTER the rewind, so the delta only counts
    // the real time we slept (a few ms), not 42s.
    assert!(
        elapsed < Duration::from_secs(1),
        "expected elapsed to be real-time only, got {elapsed:?}"
    );
}

#[test]
fn mock_clock_from_seconds_saturates_on_overflow() {
    // u64::MAX seconds × 1e9 nanos/second is well above u64::MAX
    // nanos, so we saturate to u64::MAX. Must not panic.
    let clock = MockClock::from_seconds(u64::MAX);
    assert_eq!(clock.unix_nanos(), u64::MAX);
}

#[test]
fn system_and_mock_clocks_are_interchangeable_via_trait_object() {
    let system: Arc<dyn HexTimePort> = Arc::new(SystemClock::new());
    let mock: Arc<dyn HexTimePort> = Arc::new(MockClock::from_seconds(0u32));

    let _ = system.unix_nanos();
    let _ = mock.unix_nanos();

    // Drop through the trait object — proves the trait is
    // object-safe (which is what the call site in `adapters/mod.rs`
    // relies on for `Arc<dyn HexTimePort>` late binding).
    let _system2: Arc<dyn HexTimePort> = system.clone();
    let _mock2: Arc<dyn HexTimePort> = mock.clone();
}

#[test]
fn mock_clock_is_send_sync_via_dyn_trait() {
    use std::thread;
    let clock = MockClock::from_seconds(1u32);
    let arc: Arc<dyn HexTimePort> = Arc::new(clock);
    // Spawn a thread that pulls the clock through the trait; the
    // `Send + Sync` bound on `Arc<dyn HexTimePort>` makes this compile
    // and runs the trait method on a different thread.
    let join = thread::spawn(move || arc.unix_nanos());
    let nanos = join.join().expect("clock thread panicked");
    assert_eq!(nanos, 1_000_000_000);
}
