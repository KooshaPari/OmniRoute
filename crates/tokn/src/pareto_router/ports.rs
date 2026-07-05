// Port traits for the routing substrate. All traits are synchronous;
// FFI callers (napi-rs) must not invoke these from an async context
// without wrapping them in spawn_blocking. See docs/FFI_CONTRACT.md.

use crate::cost::LedgerSnapshot;

/// A single routing decision request from the TS engine.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct RouteRequest {
    /// Stable request id (echoed from the caller for log correlation).
    pub request_id: String,
    /// Logical model name as the user requested it.
    pub requested_model: String,
    /// Tenant id (workspace + user) the request belongs to.
    pub tenant_id: String,
    /// Per-tenant policy flags (cost ceiling, latency ceiling, etc).
    #[serde(default)]
    pub policy_tags: Vec<String>,
}

/// The routing decision returned to the caller.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct RouteDecision {
    pub request_id: String,
    /// Resolved upstream provider id (e.g. "openai", "anthropic").
    pub provider: String,
    /// Resolved upstream model id (after alias / override resolution).
    pub model: String,
    /// Estimated cost in micro-cents at decision time.
    pub est_cost_microcents: u64,
    /// Estimated p99 latency at decision time, in milliseconds.
    pub est_p99_ms: u32,
}

/// Provider-routing port. Implementations consult the provider
/// catalog, apply per-tenant policy, and return a `RouteDecision`.
pub trait RoutingPort: Send + Sync {
    fn route(&self, req: &RouteRequest) -> Result<RouteDecision, RoutingError>;
}

/// Cost port. Implementations translate provider/model into a
/// micro-cents estimate given the current pricing snapshot.
pub trait CostPort: Send + Sync {
    fn estimate(&self, provider: &str, model: &str) -> Result<u64, RoutingError>;
    fn snapshot(&self) -> LedgerSnapshot;
}

/// Ledger port. Implementations persist decisions for audit /
/// billing reconciliation. The default in-memory adapter is
/// sufficient for unit tests; the production adapter will write
/// to the TS-side SQLite (via the existing migration runner).
pub trait LedgerPort: Send + Sync {
    fn record(&self, decision: &RouteDecision, outcome: LedgerOutcome);
    fn flush(&self) -> Result<(), RoutingError>;
}

/// Outcome of a routed call, recorded alongside the decision for
/// downstream cost reconciliation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum LedgerOutcome {
    Success,
    Fallback,
    Error,
}

#[derive(Debug, thiserror::Error, serde::Serialize, serde::Deserialize)]
pub enum RoutingError {
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
    #[error("tenant policy denied: {0}")]
    PolicyDenied(String),
    #[error("pricing snapshot stale (last update {0:?})")]
    PricingStale(Option<u64>),
    #[error("ledger write failed: {0}")]
    Ledger(String),
}
