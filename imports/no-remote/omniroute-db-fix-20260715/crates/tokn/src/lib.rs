// Tokn: canonical Rust routing substrate for OmniRoute (ADR-001).
//
// Public API re-exports. Consumers (TS via napi-rs, or other Rust
// binaries in the OmniRoute workspace) interact through these.

pub mod pareto_router;
pub mod cost;

pub use pareto_router::{ParetoRouter, RoutingPort, CostPort, LedgerPort, RouteRequest, RouteDecision};
pub use cost::{LedgerEntry, LedgerSnapshot};
