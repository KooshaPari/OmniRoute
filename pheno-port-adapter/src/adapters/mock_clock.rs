//! [`MockClock`] — caller-driven [`TimePort`] adapter for deterministic tests.

use std::time::Instant;

use crate::ports::time::TimePort;

/// Deterministic [`TimePort`] for tests.
///
/// Construct with [`MockClock::new`] at a fixed `t0`; the same `t0` is
/// returned from every [`now`](TimePort::now) call. Wrap in a [`Mutex`]-backed
/// cell if a test needs to advance time under control of the test body.
///
/// [`Mutex`]: std::sync::Mutex
#[derive(Debug, Clone, Copy)]
pub struct MockClock {
    t0: Instant,
}

impl MockClock {
    /// Build a mock clock frozen at `t0`. Every subsequent
    /// [`now`](TimePort::now) call returns `t0`.
    pub fn new(t0: Instant) -> Self {
        Self { t0 }
    }
}

impl TimePort for MockClock {
    fn now(&self) -> Instant {
        self.t0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_freezes_clock_at_t0() {
        let t0 = Instant::now();
        let clock = MockClock::new(t0);
        assert_eq!(clock.now(), t0);
    }
}
