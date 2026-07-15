//! Per-provider circuit breaker. After N consecutive failures the breaker
//! opens for a cooldown, then transitions to half-open (probe) for a single
//! trial call. On success it closes; on failure it re-opens.

use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakerState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug)]
pub struct Breaker {
    state: Mutex<BreakerState>,
    consecutive_failures: Mutex<u32>,
    failure_threshold: u32,
    cooldown: Duration,
    opened_at: Mutex<Option<Instant>>,
}

impl Breaker {
    pub fn new(failure_threshold: u32, cooldown: Duration) -> Self {
        Self {
            state: Mutex::new(BreakerState::Closed),
            consecutive_failures: Mutex::new(0),
            failure_threshold,
            cooldown,
            opened_at: Mutex::new(None),
        }
    }

    pub fn state(&self) -> BreakerState {
        let mut state = self.state.lock().expect("breaker state mutex");
        // Auto-transition Open → HalfOpen after cooldown
        if *state == BreakerState::Open {
            if let Some(opened) = *self.opened_at.lock().expect("breaker opened_at mutex") {
                if opened.elapsed() >= self.cooldown {
                    *state = BreakerState::HalfOpen;
                }
            }
        }
        *state
    }

    pub fn allow(&self) -> bool {
        !matches!(self.state(), BreakerState::Open)
    }

    pub fn record_success(&self) {
        let mut state = self.state.lock().expect("breaker state mutex");
        let mut failures = self.consecutive_failures.lock().expect("breaker failures mutex");
        *state = BreakerState::Closed;
        *failures = 0;
        *self.opened_at.lock().expect("breaker opened_at mutex") = None;
    }

    pub fn record_failure(&self) {
        let mut state = self.state.lock().expect("breaker state mutex");
        let mut failures = self.consecutive_failures.lock().expect("breaker failures mutex");
        *failures += 1;
        if *failures >= self.failure_threshold || *state == BreakerState::HalfOpen {
            *state = BreakerState::Open;
            *self.opened_at.lock().expect("breaker opened_at mutex") = Some(Instant::now());
        }
    }
}

impl Default for Breaker {
    fn default() -> Self {
        Self::new(3, Duration::from_secs(30))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closed_by_default() {
        let b = Breaker::default();
        assert_eq!(b.state(), BreakerState::Closed);
        assert!(b.allow());
    }

    #[test]
    fn opens_after_threshold() {
        let b = Breaker::new(3, Duration::from_secs(30));
        b.record_failure();
        b.record_failure();
        assert_eq!(b.state(), BreakerState::Closed);
        b.record_failure();
        assert_eq!(b.state(), BreakerState::Open);
        assert!(!b.allow());
    }

    #[test]
    fn success_resets() {
        let b = Breaker::new(2, Duration::from_secs(30));
        b.record_failure();
        b.record_failure();
        assert_eq!(b.state(), BreakerState::Open);
        b.record_success();
        assert_eq!(b.state(), BreakerState::Closed);
    }
}
