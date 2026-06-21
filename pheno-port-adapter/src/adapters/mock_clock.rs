//! [`MockClock`] — deterministic time adapter for [`HexTimePort`].
//!
//! Holds a synthetic `Instant` epoch plus a synthetic wall-clock
//! nanosecond count. The synthetic epoch is captured on first use
//! (via [`MockClock::new`]) so the elapsed time of `now()` matches
//! the real elapsed wall-clock time — which keeps spans (computed via
//! `b - a`) deterministic without coupling the test to the
//! surrounding real-time pace.
//!
//! Use [`MockClock::from_seconds`] for the most common case: a clock
//! with a known wall-clock start that you can advance with
//! [`MockClock::advance`].
//!
//! ```
//! use pheno_port_adapter::adapters::MockClock;
//! use pheno_port_adapter::HexTimePort;
//!
//! let clock = MockClock::from_seconds(0u32);
//! clock.advance(std::time::Duration::from_millis(250));
//! // `now()` is now 250ms past the synthetic epoch.
//! ```
//!
//! The clock is interior-mutable via a `std::sync::Mutex` — held only
//! briefly to read or update the synthetic time, and never across an
//! `await` — so the standard library's `Mutex` is the right primitive
//! (no `parking_lot` dep). The clock is `Send + Sync` so it can be
//! shared across tasks and threads in a test harness.
//!
//! [`HexTimePort`]: crate::ports::HexTimePort

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::ports::HexTimePort;

/// Deterministic time adapter. Cloning increments a refcount; the
/// underlying state is shared.
#[derive(Clone)]
pub struct MockClock {
    inner: Arc<MockClockInner>,
}

struct MockClockInner {
    /// Synthetic instant — the epoch is captured at `new()` time so
    /// that `now().elapsed()` tracks real time, but `now()` itself is
    /// stable across multiple reads at the same instant.
    epoch: Instant,
    /// Synthetic elapsed-time offset. `now()` returns
    /// `epoch + offset`; `advance` adds to it.
    offset: Mutex<Duration>,
    /// Synthetic wall-clock nanosecond count, distinct from
    /// `Instant` and decoupled from real wall time so tests that
    /// inspect `unix_nanos` see exactly what they put in.
    unix_nanos: Mutex<u64>,
}

impl std::fmt::Debug for MockClock {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MockClock")
            .field("offset_secs", &self.offset_secs())
            .field("unix_nanos", &self.unix_nanos())
            .finish()
    }
}

impl MockClock {
    /// Create a fresh `MockClock` anchored at the current real
    /// monotonic time with no offset, and a wall-clock start of 0.
    pub fn new() -> Self {
        Self {
            inner: Arc::new(MockClockInner {
                epoch: Instant::now(),
                offset: Mutex::new(Duration::ZERO),
                unix_nanos: Mutex::new(0),
            }),
        }
    }

    /// Convenience: a `MockClock` whose starting `unix_nanos` is the
    /// number of nanoseconds in `seconds`. The elapsed-time offset
    /// starts at 0.
    ///
    /// This is the constructor every test in this crate uses, because
    /// it makes `unix_nanos()` round-trippable (`from_seconds(7) →
    /// unix_nanos() == 7_000_000_000`) without forcing a base year.
    /// Accepts any unsigned integer type so callers can pass `0`,
    /// `42u32`, `42u64`, or any other unsigned integer without
    /// conversion noise.
    ///
    /// Saturates on overflow: the maximum representable wall-clock is
    /// `u64::MAX` nanoseconds (~584 years past the epoch), and that
    /// is exactly what the constructor returns for any input that
    /// would otherwise overflow.
    pub fn from_seconds<S>(seconds: S) -> Self
    where
        S: Into<u128>,
    {
        let secs: u128 = seconds.into();
        let nanos: u64 = secs
            .saturating_mul(1_000_000_000)
            .try_into()
            .unwrap_or(u64::MAX);
        Self {
            inner: Arc::new(MockClockInner {
                epoch: Instant::now(),
                offset: Mutex::new(Duration::ZERO),
                unix_nanos: Mutex::new(nanos),
            }),
        }
    }

    /// Advance the synthetic clock by `delta`. Both the monotonic
    /// `now()` and the wall-clock `unix_nanos()` are bumped by the
    /// same nanosecond count so the two views stay consistent.
    pub fn advance(&self, delta: Duration) {
        let delta_nanos = u64::try_from(delta.as_nanos()).unwrap_or(u64::MAX);
        *self.lock_offset() += delta;
        let new_unix = self.lock_unix_nanos().saturating_add(delta_nanos);
        *self.lock_unix_nanos() = new_unix;
    }

    /// Set the synthetic elapsed-time offset to a specific value.
    /// Useful for fast-forwarding to a known point in test setup.
    pub fn set_offset(&self, value: Duration) {
        *self.lock_offset() = value;
    }

    /// Set the synthetic wall-clock nanos to an absolute value.
    pub fn set_unix_nanos(&self, value: u64) {
        *self.lock_unix_nanos() = value;
    }

    /// Read the current offset. Exposed primarily for assertions in
    /// tests; production code should call `now()` / `unix_nanos()`.
    pub fn offset_secs(&self) -> f64 {
        let d = *self.lock_offset();
        d.as_secs_f64()
    }

    /// Read the current wall-clock nanos. Exposed primarily for
    /// assertions in tests.
    pub fn unix_nanos(&self) -> u64 {
        *self.lock_unix_nanos()
    }

    /// Acquire the offset mutex. Panics on poison — a poisoned
    /// `MockClock` mutex means a previous test panicked mid-update,
    /// which is always a bug in the test, not in `MockClock`.
    fn lock_offset(&self) -> std::sync::MutexGuard<'_, Duration> {
        self.inner
            .offset
            .lock()
            .expect("MockClock::offset mutex poisoned")
    }

    /// Acquire the wall-clock nanos mutex. See [`Self::lock_offset`]
    /// for the poison contract.
    fn lock_unix_nanos(&self) -> std::sync::MutexGuard<'_, u64> {
        self.inner
            .unix_nanos
            .lock()
            .expect("MockClock::unix_nanos mutex poisoned")
    }
}

impl Default for MockClock {
    fn default() -> Self {
        Self::new()
    }
}

impl HexTimePort for MockClock {
    fn now(&self) -> Instant {
        self.inner.epoch + *self.lock_offset()
    }

    fn unix_nanos(&self) -> u64 {
        *self.lock_unix_nanos()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_clock_has_zero_offset_and_zero_unix_nanos() {
        let clock = MockClock::default();
        assert_eq!(clock.offset_secs(), 0.0);
        assert_eq!(clock.unix_nanos(), 0);
    }

    #[test]
    fn from_seconds_round_trips_u64() {
        let clock = MockClock::from_seconds(7u64);
        assert_eq!(clock.unix_nanos(), 7_000_000_000);
    }

    #[test]
    fn from_seconds_round_trips_u32() {
        let clock = MockClock::from_seconds(42u32);
        assert_eq!(clock.unix_nanos(), 42 * 1_000_000_000);
    }

    #[test]
    fn advance_pushes_both_views_in_lockstep() {
        let clock = MockClock::from_seconds(0u32);
        let before = clock.now();
        let before_unix = clock.unix_nanos();

        clock.advance(Duration::from_millis(250));

        let after_offset = clock.now() - before;
        let after_unix = clock.unix_nanos() - before_unix;

        assert!(after_offset >= Duration::from_millis(200));
        // 250ms = 250_000_000 nanos exactly; allow a small slack for
        // any rounding in the f64-to-u64 conversion (it isn't lossy
        // here, but be defensive).
        assert!((249_000_000..=251_000_000).contains(&after_unix));
    }

    #[test]
    fn clones_share_state() {
        let a = MockClock::from_seconds(0u32);
        let b = a.clone();
        a.advance(Duration::from_secs(1));
        assert_eq!(b.unix_nanos(), 1_000_000_000);
    }

    #[test]
    fn from_seconds_saturates_on_overflow() {
        // u64::MAX seconds × 1e9 nanos/second is well above u64::MAX
        // nanos, so we saturate to u64::MAX. Must not panic.
        let clock = MockClock::from_seconds(u64::MAX);
        assert_eq!(clock.unix_nanos(), u64::MAX);
    }
}
