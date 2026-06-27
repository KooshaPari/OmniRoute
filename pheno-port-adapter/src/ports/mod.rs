//! Hex-port traits (the "P" in hexagonal architecture).
//!
//! Each module in this directory defines a *port* — a trait that captures
//! one side of an application/service boundary without committing to a
//! concrete backing technology. Adapters live in `crate::adapters` and
//! `impl HexPort for ConcreteAdapter` to provide the actual capability.
//!
//! Per ADR-038 (Hexagonal port-adapter L4 policy) every port trait:
//!
//! - Is `Send + Sync` (consumers may run on multi-threaded executors).
//! - Surfaces its own error type (no shared global `AdapterError`).
//! - Is documented at the trait level with: what it abstracts, what
//!   guarantees adapters must uphold, and what is intentionally out of
//!   scope.
//!
//! New ports are added by:
//!
//! 1. Drop a `<capability>.rs` module here declaring the trait + error.
//! 2. Re-export from `lib.rs` (`pub use ports::cache::HexCachePort`).
//! 3. Land at least one adapter under `crate::adapters` that implements it.
//! 4. Add a smoke test under `tests/` exercising the adapter against the
//!    trait surface (not the adapter's concrete type).

pub mod cache;

pub use cache::{CacheError, HexCachePort};
