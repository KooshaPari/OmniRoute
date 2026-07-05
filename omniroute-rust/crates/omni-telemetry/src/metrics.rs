//! Thread-safe in-memory metrics registry. Prometheus-style primitives:
//! counter (monotonic), gauge (bidirectional), histogram (distribution).
//!
//! `Metrics` holds Arc-shared `Counter`/`Gauge`/`Histogram` instances keyed
//! by name. Handles are cheap to clone and pass across threads.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

/// A monotonic counter.
#[derive(Debug, Default)]
pub struct Counter {
    value: AtomicU64,
}

impl Counter {
    pub fn new() -> Self { Self::default() }
    pub fn inc(&self) { self.value.fetch_add(1, Ordering::Relaxed); }
    pub fn add(&self, n: u64) { self.value.fetch_add(n, Ordering::Relaxed); }
    pub fn get(&self) -> u64 { self.value.load(Ordering::Relaxed) }
}

/// A bidirectional gauge.
#[derive(Debug, Default)]
pub struct Gauge {
    value: AtomicI64,
}

impl Gauge {
    pub fn new() -> Self { Self::default() }
    pub fn set(&self, v: i64) { self.value.store(v, Ordering::Relaxed); }
    pub fn inc(&self) { self.value.fetch_add(1, Ordering::Relaxed); }
    pub fn dec(&self) { self.value.fetch_sub(1, Ordering::Relaxed); }
    pub fn get(&self) -> i64 { self.value.load(Ordering::Relaxed) }
}

/// A histogram with fixed bucket boundaries (inclusive lower, exclusive upper).
#[derive(Debug)]
pub struct Histogram {
    bounds: Vec<f64>,
    counts: Vec<AtomicU64>,
    sum: Mutex<f64>,
    count: AtomicU64,
}

impl Histogram {
    /// Create a histogram with sorted ascending bucket upper bounds.
    pub fn new(bounds: Vec<f64>) -> Self {
        assert!(!bounds.is_empty(), "histogram must have at least one bucket");
        assert!(bounds.windows(2).all(|w| w[0] < w[1]), "bounds must be sorted ascending");
        let counts = (0..bounds.len()).map(|_| AtomicU64::new(0)).collect();
        Self { bounds, counts, sum: Mutex::new(0.0), count: AtomicU64::new(0) }
    }

    pub fn observe(&self, value: f64) {
        for (i, b) in self.bounds.iter().enumerate() {
            if value < *b {
                self.counts[i].fetch_add(1, Ordering::Relaxed);
                break;
            }
        }
        self.count.fetch_add(1, Ordering::Relaxed);
        if let Ok(mut s) = self.sum.lock() { *s += value; }
    }

    pub fn count(&self) -> u64 { self.count.load(Ordering::Relaxed) }
    pub fn sum(&self) -> f64 { self.sum.lock().map(|g| *g).unwrap_or(0.0) }
    pub fn bucket_counts(&self) -> Vec<u64> {
        self.counts.iter().map(|c| c.load(Ordering::Relaxed)).collect()
    }
    pub fn bounds(&self) -> &[f64] { &self.bounds }
}

/// Process-global metrics registry. Holds named counters/gauges/histograms
/// behind Arc so handles are cheap to clone.
#[derive(Debug, Default)]
pub struct Metrics {
    counters: Mutex<BTreeMap<String, Arc<Counter>>>,
    gauges: Mutex<BTreeMap<String, Arc<Gauge>>>,
    histograms: Mutex<BTreeMap<String, Arc<Histogram>>>,
}

impl Metrics {
    pub fn new() -> Self { Self::default() }

    /// Get or create a counter by name.
    pub fn counter(&self, name: &str) -> Arc<Counter> {
        let mut map = self.counters.lock().expect("metrics mutex poisoned");
        if let Some(c) = map.get(name) { return c.clone(); }
        let c = Arc::new(Counter::new());
        map.insert(name.to_string(), c.clone());
        c
    }

    /// Get or create a gauge by name.
    pub fn gauge(&self, name: &str) -> Arc<Gauge> {
        let mut map = self.gauges.lock().expect("metrics mutex poisoned");
        if let Some(g) = map.get(name) { return g.clone(); }
        let g = Arc::new(Gauge::new());
        map.insert(name.to_string(), g.clone());
        g
    }

    /// Get or create a histogram by name. First call wins on bounds.
    pub fn histogram(&self, name: &str, bounds: Vec<f64>) -> Arc<Histogram> {
        let mut map = self.histograms.lock().expect("metrics mutex poisoned");
        if let Some(h) = map.get(name) { return h.clone(); }
        let h = Arc::new(Histogram::new(bounds));
        map.insert(name.to_string(), h.clone());
        h
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        let counters = self.counters.lock().expect("mutex")
            .iter().map(|(k, v)| (k.clone(), v.get())).collect();
        let gauges = self.gauges.lock().expect("mutex")
            .iter().map(|(k, v)| (k.clone(), v.get())).collect();
        let histograms = self.histograms.lock().expect("mutex")
            .iter().map(|(k, v)| HistogramSnapshot {
                name: k.clone(),
                count: v.count(),
                sum: v.sum(),
                bucket_counts: v.bucket_counts(),
                bounds: v.bounds().to_vec(),
            }).collect();
        MetricsSnapshot { counters, gauges, histograms }
    }
}

/// Point-in-time view of all metrics, suitable for serialization.
#[derive(Debug, Clone, Default)]
pub struct MetricsSnapshot {
    pub counters: BTreeMap<String, u64>,
    pub gauges: BTreeMap<String, i64>,
    pub histograms: Vec<HistogramSnapshot>,
}

#[derive(Debug, Clone)]
pub struct HistogramSnapshot {
    pub name: String,
    pub count: u64,
    pub sum: f64,
    pub bucket_counts: Vec<u64>,
    pub bounds: Vec<f64>,
}
