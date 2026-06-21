//! [`SystemClock`] — wall-clock-backed [`TimePort`] adapter for production.

use std::time::Instant;

use crate::ports::time::TimePort;

/// [`TimePort`] backed by [`std::time::Instant::now`].
///
/// Wall-clock skew is irrelevant for the in-process math that adapters tend to
/// do (retry budgets, rate-limit windows, deadline propagation) because
/// `Instant` is monotonic. Use this when the caller wants "now" relative to
/// the process lifetime; use a separate [`crate::ports::time::TimePort`]
/// adapter if a different clock domain is required (e.g. a virtual scheduler).
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl TimePort for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }
}
