//! [`HexTimePort`] — monotonic + wall-clock time port.
//!
//! This is the *port* (hexagonal "P") for "what time is it?" — used by
//! application code for both deadline/debounce logic (monotonic) and
//! timestamp generation (wall-clock). Adapters in `crate::adapters`
//! provide concrete implementations:
//!
//! - [`crate::adapters::SystemClock`] — real wall clock + monotonic
//!   instant. Use in production.
//! - [`crate::adapters::MockClock`] — frozen clock for tests; the
//!   monotonic instant and the wall-clock unix nanos are decoupled so
//!   tests can assert "wall-clock-equals-X" without sleeping.
//!
//! ## Why both `now()` and `unix_nanos()`?
//!
//! - `now()` returns a monotonic [`Instant`]; use it for measuring
//!   *elapsed time* and computing *deadlines*. Never subtract one
//!   `Instant` from a wall-clock value.
//! - `unix_nanos()` returns the wall-clock time as nanoseconds since the
//!   unix epoch; use it for *timestamps* (logs, audit trails,
//!   cache-TTL headers, ...). Never use it to compute *elapsed time* —
//!   wall clock can jump backwards (NTP correction, DST, manual
//!   `date -s`).
//!
//! Callers that need both pick the right one for the question being
//! asked.
//!
//! ## Out of scope
//!
//! - Time-zone-aware formatting. If you need `2026-06-21T12:34:56Z`,
//!   convert `unix_nanos()` to a `chrono::DateTime` (or equivalent) at
//!   the formatting layer, not in the port.
//! - High-resolution timers (`<1ns`). `Instant` is already as precise
//!   as the OS allows; `unix_nanos()` is nanosecond-resolution but
//!   not nanosecond-accurate (clocks skew).
//!
//! [`Instant`]: std::time::Instant

use std::time::Instant;

/// Async-free clock port (hexagonal "P").
///
/// `Send + Sync` is required so the trait can be stored in
/// `Arc<dyn HexTimePort>` and shared across threads (deadline scheduling
/// runs on a background task in most services).
///
/// The trait is intentionally **not** `async` — both methods are
/// cheap, side-effect-free queries that should never block. Async here
/// would just push complexity onto callers without buying anything.
pub trait HexTimePort: Send + Sync {
    /// Current monotonic instant.
    ///
    /// Use this for *elapsed time* measurements and *deadline*
    /// calculations. Monotonic clocks never go backwards (unlike wall
    /// clocks, which can jump on NTP correction, DST, ...).
    fn now(&self) -> Instant;

    /// Current wall-clock time as nanoseconds since the unix epoch
    /// (`1970-01-01T00:00:00Z`).
    ///
    /// Use this for *timestamps* — logs, audit trails, cache TTLs,
    /// HTTP `Date` headers, ... Do NOT use it for elapsed-time
    /// calculations: wall clocks can jump.
    ///
    /// Returns `0` if the system clock is set before the unix epoch
    /// (rare; mostly affects misconfigured embedded systems).
    fn unix_nanos(&self) -> u64;
}
