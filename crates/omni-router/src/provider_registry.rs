//! In-memory provider registry. Maps a provider ID to its handle (a struct
//! holding config, breaker, and per-provider stats).

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use parking_lot::RwLock;

use crate::breaker::Breaker;
use crate::router::RoutingContext;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ProviderId(pub String);

impl ProviderId {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }
}

impl std::fmt::Display for ProviderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Debug)]
pub struct ProviderHandle {
    pub id: ProviderId,
    pub display_name: String,
    pub base_url: String,
    /// Models this provider exposes.
    pub models: Vec<String>,
    /// Per-1K token cost in USD. Negative = unknown.
    pub cost_per_1k_prompt: f64,
    pub cost_per_1k_completion: f64,
    /// Order in the fallback chain (lower = earlier).
    pub fallback_priority: usize,
    /// Per-provider weight (higher = more traffic under Weighted strategy).
    pub weight: u32,
    /// Average latency over the last 60s, in milliseconds.
    pub avg_latency_ms: f64,
    /// Circuit breaker.
    pub circuit_breaker: Breaker,
    /// Round-robin counter.
    rr_counter: AtomicU64,
    /// Total calls.
    pub call_count: AtomicUsize,
}

impl ProviderHandle {
    pub fn new(id: ProviderId, display_name: String, base_url: String) -> Self {
        Self {
            id,
            display_name,
            base_url,
            models: Vec::new(),
            cost_per_1k_prompt: 0.0,
            cost_per_1k_completion: 0.0,
            fallback_priority: usize::MAX,
            weight: 1,
            avg_latency_ms: 0.0,
            circuit_breaker: Breaker::default(),
            rr_counter: AtomicU64::new(0),
            call_count: AtomicUsize::new(0),
        }
    }

    pub fn supports_model(&self, model: &str) -> bool {
        // Wildcard "all" support
        if self.models.iter().any(|m| m == "*") {
            return true;
        }
        self.models.iter().any(|m| {
            m == model
                || (m.ends_with('*') && model.starts_with(&m[..m.len() - 1]))
                || (m.starts_with('*') && model.ends_with(&m[1..]))
        })
    }

    pub fn rr_counter(&self) -> u64 {
        self.rr_counter.fetch_add(1, Ordering::Relaxed)
    }

    /// Compute a weighted score combining cost, latency, weight, and breaker state.
    pub fn weighted_score(&self, ctx: &RoutingContext) -> f64 {
        let cost = -(self.cost_per_1k_prompt + self.cost_per_1k_completion);
        let latency = -self.avg_latency_ms;
        let weight = self.weight as f64;
        let headroom = ctx.budget_remaining_usd.unwrap_or(f64::INFINITY);
        let affordable = if self.cost_per_1k_prompt * (ctx.estimated_tokens as f64 / 1000.0) < headroom {
            1.0
        } else {
            -1.0
        };
        0.5 * cost + 0.3 * latency + 0.1 * weight + 0.1 * affordable
    }
}

#[derive(Default)]
pub struct ProviderRegistry {
    providers: RwLock<HashMap<ProviderId, Arc<ProviderHandle>>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&self, handle: ProviderHandle) {
        let mut map = self.providers.write();
        map.insert(handle.id.clone(), Arc::new(handle));
    }

    pub fn get(&self, id: &ProviderId) -> Option<Arc<ProviderHandle>> {
        self.providers.read().get(id).cloned()
    }

    pub fn list(&self) -> Vec<Arc<ProviderHandle>> {
        self.providers.read().values().cloned().collect()
    }

    pub fn len(&self) -> usize {
        self.providers.read().len()
    }

    pub fn is_empty(&self) -> bool {
        self.providers.read().is_empty()
    }

    pub fn remove(&self, id: &ProviderId) -> Option<Arc<ProviderHandle>> {
        self.providers.write().remove(id)
    }
}

pub fn default_breaker_for_id(_id: &ProviderId) -> Breaker {
    Breaker::new(3, Duration::from_secs(30))
}
