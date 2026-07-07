//! Trailing-edge debouncer.
//!
//! `should_fire()` returns true only after `quiet_period` has elapsed
//! without any `touch()` calls. Pair with `touch()` to record activity.

use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct Debouncer {
    last_call: Mutex<Instant>,
    quiet_period: Duration,
}

impl Debouncer {
    pub fn new(quiet_period: Duration) -> Self {
        // Seed last_call far in the past so the very first should_fire is true
        // until the first touch().
        Self {
            last_call: Mutex::new(Instant::now() - Duration::from_secs(60 * 365 * 100)),
            quiet_period,
        }
    }

    /// Record that an activity just happened. Resets the quiet-period clock.
    pub fn touch(&self) {
        let mut g = self.last_call.lock().expect("debouncer mutex poisoned");
        *g = Instant::now();
    }

    /// Returns true if `quiet_period` has elapsed since the last `touch()`.
    pub fn should_fire(&self) -> bool {
        let g = self.last_call.lock().expect("debouncer mutex poisoned");
        Instant::now().duration_since(*g) >= self.quiet_period
    }

    pub fn quiet_period(&self) -> Duration {
        self.quiet_period
    }

    /// Time remaining before `should_fire()` flips to true.
    pub fn remaining(&self) -> Duration {
        let g = self.last_call.lock().expect("debouncer mutex poisoned");
        let elapsed = Instant::now().duration_since(*g);
        if elapsed >= self.quiet_period {
            Duration::ZERO
        } else {
            self.quiet_period - elapsed
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn fresh_debouncer_fires_immediately() {
        let d = Debouncer::new(Duration::from_millis(50));
        assert!(d.should_fire());
    }

    #[test]
    fn rapid_touches_suppress_fire() {
        let period = Duration::from_millis(50);
        let d = Debouncer::new(period);
        for _ in 0..10 {
            d.touch();
            sleep(Duration::from_millis(2));
        }
        assert!(!d.should_fire(), "should not fire while calls keep coming");
    }

    #[test]
    fn fires_after_quiet_period() {
        let period = Duration::from_millis(30);
        let d = Debouncer::new(period);
        d.touch();
        assert!(!d.should_fire());
        sleep(Duration::from_millis(40));
        assert!(d.should_fire(), "must fire after quiet_period elapses");
    }

    #[test]
    fn touch_resets_clock() {
        let period = Duration::from_millis(30);
        let d = Debouncer::new(period);
        sleep(Duration::from_millis(20));
        assert!(d.should_fire());
        d.touch();
        assert!(!d.should_fire());
    }

    #[test]
    fn remaining_decreases() {
        let period = Duration::from_millis(100);
        let d = Debouncer::new(period);
        d.touch();
        let r1 = d.remaining();
        assert!(r1 <= period);
        sleep(Duration::from_millis(30));
        let r2 = d.remaining();
        assert!(r2 < r1, "remaining must shrink as time passes");
    }
}
