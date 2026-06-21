//! [`TimePort`] — hexagonal port for obtaining the current instant.
//!
//! Production code wires [`crate::adapters::SystemClock`]; tests wire
//! [`crate::adapters::MockClock`]. Returning
//! [`std::time::Instant`] (monotonic) instead of [`std::time::SystemTime`]
//! (wall-clock) keeps callers immune to wall-clock skew, NTP adjustments, and
//! DST jumps — properties that matter for retry budgets, deadline propagation,
//! and rate-limiter math.
use std::time::Instant;

/// Hexagonal port for "what time is it?".
///
/// Implementations:
///
/// - [`crate::adapters::SystemClock`] — wall-clock-backed, for production.
/// - [`crate::adapters::MockClock`] — caller-driven, for deterministic tests.
///
/// All implementations must be safe to call from multiple threads (`Send +
/// Sync`) because callers may share a single clock behind an `Arc`.
pub trait TimePort: Send + Sync {
    /// Returns the current instant according to this clock.
    fn now(&self) -> Instant;
}
