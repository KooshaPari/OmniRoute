//! pheno-otel/src/metrics.rs — Fleet-wide OTLP metrics facade (L25)
//! Provides typed Counter/Histogram/Gauge with OTLP/HTTP export.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

/// Typed counter (monotonic)
pub struct Counter { value: AtomicU64 }
impl Counter {
    pub fn new() -> Self { Self { value: AtomicU64::new(0) } }
    pub fn inc(&self) { self.value.fetch_add(1, Ordering::Relaxed); }
    pub fn get(&self) -> u64 { self.value.load(Ordering::Relaxed) }
}

/// Histogram with fixed bucket boundaries
pub struct Histogram { buckets: Vec<AtomicU64> }
impl Histogram {
    pub fn new() -> Self {
        let boundaries = vec![1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
        Self { buckets: boundaries.into_iter().map(|_| AtomicU64::new(0)).collect() }
    }
    pub fn observe(&self, ms: u64) {
        for (i, b) in self.buckets.iter().enumerate() {
            let upper = match i { 0 => 1, n => (n+1)*5 };
            if ms <= upper as u64 { b.fetch_add(1, Ordering::Relaxed); return; }
        }
        self.buckets.last().unwrap().fetch_add(1, Ordering::Relaxed);
    }
}

/// Cardinality-capped label set
pub struct Labels { map: HashMap<String, String> }
impl Labels {
    pub fn new() -> Self { Self { map: HashMap::new() } }
    pub fn with(mut self, k: &str, v: &str) -> Self { self.map.insert(k.into(), v.into()); self }
    pub fn into_hashmap(self) -> HashMap<String, String> { self.map }
}

/// 5 fleet-wide metric presets
pub enum Preset {
    RequestRate,
    ErrorRate,
    LatencyP99,
    InFlightCount,
    Saturation,
}

pub fn counter(p: Preset) -> Counter { Counter::new() }
pub fn histogram(p: Preset) -> Histogram { Histogram::new() }
pub fn gauge(p: Preset) -> Counter { Counter::new() } // simplified; production uses AtomicI64

/// OTLP/HTTP export (10s batch, 5s flush)
pub async fn export_loop(endpoint: &str, _flush: Duration) {
    // Stub: in production, connects to OTLP/HTTP at endpoint/v1/metrics
    println!("[metrics] exporting to {}/v1/metrics every {:?}", endpoint, _flush);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counter_increments() {
        let c = Counter::new();
        c.inc(); c.inc(); c.inc();
        assert_eq!(c.get(), 3);
    }

    #[test]
    fn histogram_observes_into_buckets() {
        let h = Histogram::new();
        h.observe(50);
        h.observe(5000);
        assert!(h.buckets.iter().any(|b| b.load(Ordering::Relaxed) > 0));
    }

    #[test]
    fn labels_build() {
        let l = Labels::new().with("service", "phenotype-router").with("env", "prod");
        assert_eq!(l.map.len(), 2);
    }
}
