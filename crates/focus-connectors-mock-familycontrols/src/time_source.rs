// SPDX-License-Identifier: MIT OR Apache-2.0

//! Time source abstraction for deterministic testing and demo choreography.
//!
//! Traces to: FR-MOCK-003 (deterministic time).

use chrono::{DateTime, Utc};
use std::any::Any;
use std::sync::Mutex;

/// Abstract time source for pluggable time behavior.
pub trait TimeSource: Send + Sync {
    /// Return the current time.
    fn now(&self) -> DateTime<Utc>;

    /// Cast to Any for downcast_ref in tests.
    fn as_any(&self) -> &dyn Any;
}

/// Deterministic time source: supports manual advancement for demo choreography.
/// Traces to: FR-MOCK-003.
#[derive(Debug)]
pub struct DeterministicTimeSource {
    current: Mutex<DateTime<Utc>>,
}

impl DeterministicTimeSource {
    pub fn new(initial: DateTime<Utc>) -> Self {
        Self {
            current: Mutex::new(initial),
        }
    }

    /// Manually set the current time.
    pub fn set_now(&self, time: DateTime<Utc>) {
        let mut current = self.current.lock().expect("time source poisoned");
        *current = time;
    }

    /// Advance time by a duration.
    pub fn advance(&self, duration: chrono::Duration) {
        let mut current = self.current.lock().expect("time source poisoned");
        *current += duration;
    }
}

impl Default for DeterministicTimeSource {
    fn default() -> Self {
        // Start at a known epoch for reproducibility.
        Self::new(Utc::now())
    }
}

impl TimeSource for DeterministicTimeSource {
    fn now(&self) -> DateTime<Utc> {
        let current = self.current.lock().expect("time source poisoned");
        *current
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

/// Real time source (actual system clock).
#[derive(Debug)]
pub struct RealTimeSource;

impl TimeSource for RealTimeSource {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    // Traces to: FR-MOCK-003
    #[test]
    fn deterministic_time_source_manual_set() {
        let ts = DeterministicTimeSource::default();
        let t0 = ts.now();
        let t1 = t0 + Duration::seconds(100);
        ts.set_now(t1);
        let t2 = ts.now();
        assert_eq!(t2, t1);
    }

    // Traces to: FR-MOCK-003
    #[test]
    fn deterministic_time_source_advance() {
        let ts = DeterministicTimeSource::default();
        let t0 = ts.now();
        ts.advance(Duration::seconds(60));
        let t1 = ts.now();
        assert_eq!(t1 - t0, Duration::seconds(60));
    }

    // Traces to: FR-MOCK-003
    #[test]
    fn real_time_source_returns_current_time() {
        let ts = RealTimeSource;
        let before = Utc::now();
        let now = ts.now();
        let after = Utc::now();
        assert!(now >= before);
        assert!(now <= after);
    }

    // Traces to: FR-MOCK-003
    #[test]
    fn deterministic_downcast() {
        use std::sync::Arc;
        let ts: Arc<dyn TimeSource> = Arc::new(DeterministicTimeSource::default());
        let any = ts.as_any();
        assert!(any.downcast_ref::<DeterministicTimeSource>().is_some());
    }
}
