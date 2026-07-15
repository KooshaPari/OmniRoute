//! Top-level Router: takes a request, picks a provider, executes.

use std::sync::Arc;

use crate::provider_registry::{ProviderHandle, ProviderRegistry};
use crate::strategy::{score, Strategy};

#[derive(Debug, Clone)]
pub struct RoutingContext {
    pub model: String,
    pub estimated_tokens: u32,
    pub budget_remaining_usd: Option<f64>,
    pub require_streaming: bool,
    pub strategy: Strategy,
}

impl Default for RoutingContext {
    fn default() -> Self {
        Self {
            model: String::new(),
            estimated_tokens: 0,
            budget_remaining_usd: None,
            require_streaming: false,
            strategy: Strategy::FallbackChain,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RoutingDecision {
    pub chosen: Arc<ProviderHandle>,
    pub reason: String,
    pub alternatives: Vec<Arc<ProviderHandle>>,
}

pub struct Router {
    /// Shared with `App.registry` so registrations on either side are visible
    /// to both. The interior `RwLock<HashMap>` is what makes that safe.
    registry: Arc<ProviderRegistry>,
}

impl Router {
    pub fn new(registry: Arc<ProviderRegistry>) -> Self {
        Self { registry }
    }

    pub fn registry(&self) -> &Arc<ProviderRegistry> {
        &self.registry
    }

    /// Register a provider with the shared registry. Equivalent to
    /// `app.registry.insert(handle)` — kept here so handlers can avoid a
    /// second route.
    pub fn register(&self, handle: ProviderHandle) {
        self.registry.insert(handle);
    }

    /// Pick the best provider for the given context. Returns the chosen handle
    /// plus a list of fallback alternatives.
    pub fn route(&self, ctx: &RoutingContext) -> Result<RoutingDecision, crate::RouterError> {
        let candidates = self.registry.list();
        if candidates.is_empty() {
            return Err(crate::RouterError::NoProvider(ctx.model.clone()));
        }
        let scored = score(ctx, &candidates, ctx.strategy);
        if scored.is_empty() {
            return Err(crate::RouterError::NoProvider(ctx.model.clone()));
        }
        let chosen = scored[0].handle.clone();
        let reason = scored[0].reason.clone();
        let alternatives: Vec<Arc<ProviderHandle>> = scored
            .iter()
            .skip(1)
            .map(|s| s.handle.clone())
            .collect();
        Ok(RoutingDecision {
            chosen,
            reason,
            alternatives,
        })
    }

    /// Pick N providers for a fan-out (e.g. combo / interleaved).
    pub fn fan_out(&self, ctx: &RoutingContext, n: usize) -> Vec<Arc<ProviderHandle>> {
        let candidates = self.registry.list();
        let scored = score(ctx, &candidates, ctx.strategy);
        scored.into_iter().take(n).map(|s| s.handle).collect()
    }
}
