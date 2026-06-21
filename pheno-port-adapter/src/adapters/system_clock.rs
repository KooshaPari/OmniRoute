//! [`SystemClock`] — real wall-clock + monotonic adapter for
//! [`HexTimePort`].
//!
//! Reads from the operating system's monotonic clock (`Instant::now()`)
//! and wall clock (`SystemTime::now()`). Suitable for production use —
//! no allocation, no syscalls on the hot path beyond the underlying
//! clock reads.
//!
//! [`SystemClock`] is a zero-sized type — there is no per-instance
//! state, so cloning is free and `static` storage is trivial:
//!
//! ```
//! use pheno_port_adapter::adapters::SystemClock;
//! use pheno_port_adapter::HexTimePort;
//!
//! static CLOCK: SystemClock = SystemClock;
//! let _ = CLOCK.now();
//! ```
//!
//! [`HexTimePort`]: crate::ports::HexTimePort

use std::time::{Instant, SystemTime, UNIX_EPOCH};

use crate::ports::HexTimePort;

/// Real-clock adapter for [`HexTimePort`]. Zero-sized; clones free.
///
/// [`HexTimePort`]: crate::ports::HexTimePort
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl SystemClock {
    /// Create a new `SystemClock`. Provided for parity with adapters
    /// that own state; equivalent to `SystemClock` (the unit struct) in
    /// every observable way.
    pub fn new() -> Self {
        Self
    }
}

impl HexTimePort for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }

    fn unix_nanos(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| u64::try_from(d.as_nanos()).unwrap_or(u64::MAX))
            // 0 sentinel for pre-1970 clocks; documented on the trait.
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn now_is_monotonic_advancing() {
        let clock = SystemClock::new();
        let a = clock.now();
        // Spin briefly to guarantee the monotonic clock ticks forward.
        // On all real platforms `Instant` has sub-microsecond
        // resolution, so a busy loop of 1000 iterations is more than
        // enough.
        let mut sink: u64 = 0;
        for i in 0..1000u64 {
            sink = sink.wrapping_add(i);
        }
        std::hint::black_box(sink);
        let b = clock.now();
        assert!(b >= a, "monotonic clock went backwards: {a:?} > {b:?}");
    }

    #[test]
    fn unix_nanos_is_a_reasonable_post_epoch_value() {
        let clock = SystemClock::new();
        let nanos = clock.unix_nanos();
        // 2020-01-01T00:00:00Z is roughly 1.58e18 nanos. Pick a
        // conservative lower bound well before that so the test passes
        // for the foreseeable future without being meaningless.
        let year_2020_nanos: u64 = 1_577_836_800_u64 * 1_000_000_000;
        assert!(
            nanos > year_2020_nanos,
            "unix_nanos should be after 2020-01-01, got {nanos}"
        );
    }

    #[test]
    fn two_consecutive_unix_nanos_are_monotonic_or_equal() {
        let clock = SystemClock::new();
        let a = clock.unix_nanos();
        // Tiny busy-wait; even at 1ns resolution we should usually
        // see a strictly greater value, but monotonic-or-equal is the
        // strictest guarantee `SystemTime` offers across versions.
        std::thread::sleep(Duration::from_millis(1));
        let b = clock.unix_nanos();
        assert!(b >= a, "wall clock went backwards: {a} > {b}");
    }
}
