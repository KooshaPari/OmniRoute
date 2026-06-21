//! Hexagonal `port` traits — the *primary* types a host application
//! depends on.
//!
//! Following ADR-038 (hexagonal port-adapter L4 policy), ports are the
//! abstractions that the application logic ports against; adapters are the
//! concrete implementations injected at the composition root.
//!
//! The crate ships two top-level concerns:
//!
//! - [`time::TimePort`] — a wall-clock/clock trait that callers can use to
//!   obtain the current instant. Production code wires the
//!   [`crate::adapters::SystemClock`] adapter; tests wire the
//!   [`crate::adapters::MockClock`] adapter for determinism.

pub mod time;
