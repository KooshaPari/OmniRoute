//! Routing strategies. Each takes a `RoutingContext` and an iterator of
//! available `ProviderHandle`s and returns them sorted by preference.

use std::sync::Arc;

use crate::provider_registry::ProviderHandle;
use crate::router::RoutingContext;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Strategy {
    /// Pick the cheapest provider (per 1K tokens) that supports the model.
    CostFirst,
    /// Pick the lowest-latency provider (over the last 60s).
    LatencyFirst,
    /// Round-robin across healthy providers.
    RoundRobin,
    /// Random pick across healthy providers.
    Random,
    /// Try providers in the configured order until one succeeds.
    FallbackChain,
    /// Pick the highest-scoring provider across multiple factors.
    Weighted,
}

/// A single scored candidate.
#[derive(Debug, Clone)]
pub struct RouteScore {
    pub handle: Arc<ProviderHandle>,
    pub score: f64,
    pub reason: String,
}

pub fn score(
    ctx: &RoutingContext,
    handles: &[Arc<ProviderHandle>],
    strategy: Strategy,
) -> Vec<RouteScore> {
    let mut scored: Vec<RouteScore> = handles
        .iter()
        .filter(|h| h.circuit_breaker.allow())
        .filter(|h| h.supports_model(&ctx.model))
        .map(|h| {
            let score = match strategy {
                Strategy::CostFirst => -(h.cost_per_1k_prompt + h.cost_per_1k_completion),
                Strategy::LatencyFirst => -h.avg_latency_ms,
                Strategy::RoundRobin => -(h.rr_counter() as f64),
                Strategy::Random => rand::random::<f64>(),
                Strategy::FallbackChain => -(h.fallback_priority as f64),
                Strategy::Weighted => h.weighted_score(ctx),
            };
            RouteScore {
                handle: h.clone(),
                score,
                reason: format!("{strategy:?} score={score:.2}"),
            }
        })
        .collect();
    scored.sort_by(|a, b| {
        a.score
            .partial_cmp(&b.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    scored
}
