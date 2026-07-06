// ParetoRouter: port + adapter pattern for routing decisions.
//
// `ports.rs` defines the trait surfaces. `adapters.rs` provides a
// default synchronous impl. The TS engine calls into `ParetoRouter`
// via napi-rs (see docs/FFI_CONTRACT.md).

pub mod ports;
pub mod adapters;

pub use ports::{RoutingPort, CostPort, LedgerPort, RouteRequest, RouteDecision};
pub use adapters::ParetoRouter;
