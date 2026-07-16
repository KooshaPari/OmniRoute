// Default adapter wiring: a `ParetoRouter` composes a `RoutingPort`,
// a `CostPort`, and a `LedgerPort`. The ParetoRouter is the only
// type the TS engine interacts with directly.

use std::sync::Arc;

use super::ports::{
    CostPort, LedgerPort, LedgerOutcome, RouteDecision, RouteRequest, RoutingError, RoutingPort,
};

/// The composed router. Held in an `Arc` for cheap cloning across
/// the FFI boundary.
#[derive(Clone)]
#[allow(dead_code)]
pub struct ParetoRouter {
    routing: Arc<dyn RoutingPort>,
    cost: Arc<dyn CostPort>,
    ledger: Arc<dyn LedgerPort>,
}

impl ParetoRouter {
    pub fn new(
        routing: Arc<dyn RoutingPort>,
        cost: Arc<dyn CostPort>,
        ledger: Arc<dyn LedgerPort>,
    ) -> Self {
        Self { routing, cost, ledger }
    }

    /// Resolve a routing request and record the decision.
    /// This is the single FFI-exposed entry point.
    pub fn decide(&self, req: &RouteRequest) -> Result<RouteDecision, RoutingError> {
        let decision = self.routing.route(req)?;
        self.ledger.record(&decision, LedgerOutcome::Success);
        Ok(decision)
    }
}
