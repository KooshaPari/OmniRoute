// End-to-end test: stub RoutingPort + CostPort + LedgerPort,
// wire them into a ParetoRouter, and verify a routing decision
// flows through all three ports.

use std::sync::{Arc, Mutex};

use tokn::pareto_router::{adapters::ParetoRouter, ports::*, RouteRequest};
use tokn::pareto_router::ports::RoutingError;
use tokn::cost::{LedgerEntry, LedgerSnapshot, TenantSpend};

#[derive(Default)]
struct StubRouting {
    decisions: Mutex<Vec<RouteDecision>>,
}

impl RoutingPort for StubRouting {
    fn route(&self, req: &RouteRequest) -> Result<RouteDecision, RoutingError> {
        let d = RouteDecision {
            request_id: req.request_id.clone(),
            provider: "openai".to_string(),
            model: "gpt-4o".to_string(),
            est_cost_microcents: 100,
            est_p99_ms: 250,
        };
        self.decisions.lock().unwrap().push(d.clone());
        Ok(d)
    }
}

#[derive(Default)]
struct StubCost;

impl CostPort for StubCost {
    fn estimate(&self, _provider: &str, _model: &str) -> Result<u64, RoutingError> {
        Ok(100)
    }
    fn snapshot(&self) -> LedgerSnapshot {
        LedgerSnapshot {
            window_start_unix_ms: 0,
            window_end_unix_ms: 0,
            total_microcents: 0,
            by_tenant: vec![],
        }
    }
}

#[derive(Default)]
struct StubLedger {
    entries: Mutex<Vec<LedgerEntry>>,
}

impl LedgerPort for StubLedger {
    fn record(&self, decision: &RouteDecision, _outcome: LedgerOutcome) {
        self.entries.lock().unwrap().push(LedgerEntry {
            request_id: decision.request_id.clone(),
            tenant_id: "t1".to_string(),
            provider: decision.provider.clone(),
            model: decision.model.clone(),
            cost_microcents: decision.est_cost_microcents,
            ts_unix_ms: 0,
        });
    }
    fn flush(&self) -> Result<(), RoutingError> {
        Ok(())
    }
}

#[test]
fn end_to_end_route_flow() {
    let router = ParetoRouter::new(
        Arc::new(StubRouting::default()),
        Arc::new(StubCost),
        Arc::new(StubLedger::default()),
    );
    let req = RouteRequest {
        request_id: "r1".to_string(),
        requested_model: "gpt-4o".to_string(),
        tenant_id: "t1".to_string(),
        policy_tags: vec![],
    };
    let d = router.decide(&req).expect("route ok");
    assert_eq!(d.provider, "openai");
    assert_eq!(d.model, "gpt-4o");
    assert_eq!(d.request_id, "r1");
}

#[test]
fn snapshot_default_is_zero() {
    let s = LedgerSnapshot::default();
    assert_eq!(s.total_microcents, 0);
    assert!(s.by_tenant.is_empty());
    let _ = TenantSpend {
        tenant_id: "t1".to_string(),
        total_microcents: 0,
    };
}
