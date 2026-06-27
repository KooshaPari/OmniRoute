//! scripts/perf-gate — fleet performance gate (v19 T4, L19 Performance Benchmarks).
//!
//! Loads `benchmarks/fleet-perf.toml`, evaluates measured p95 samples against
//! each method's declared budget, and renders a verdict (Pass / Fail).
//!
//! Authority: ADR-040 (test coverage gates per tier) + v19 71-pillar cycle 9
//! plan §2 Track T4. See `plans/2026-06-21-v19-71-pillar-cycle-9-p0.md`.
//!
//! The binary `perf_gate` lives in `src/bin/perf_gate.rs`. The Python
//! implementation in `scripts/perf_gate.py` is kept as a legacy alternative.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod budgets;
pub mod config;
pub mod gate;
pub mod report;
pub mod summary;
