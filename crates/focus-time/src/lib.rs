// SPDX-License-Identifier: MIT OR Apache-2.0

//! Clock abstraction for deterministic tests.

use chrono::{DateTime, Utc};

pub trait ClockPort: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

pub struct SystemClock;

impl ClockPort for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

pub struct TestClock {
    pub fixed: std::sync::Mutex<DateTime<Utc>>,
}

impl TestClock {
    pub fn new(initial: DateTime<Utc>) -> Self {
        Self { fixed: std::sync::Mutex::new(initial) }
    }

    pub fn advance(&self, by: chrono::Duration) {
        let mut t = self.fixed.lock().unwrap();
        *t += by;
    }
}

impl ClockPort for TestClock {
    fn now(&self) -> DateTime<Utc> {
        *self.fixed.lock().unwrap()
    }
}
