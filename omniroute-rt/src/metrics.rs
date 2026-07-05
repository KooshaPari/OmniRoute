//! OTel-compatible metrics for the Rust data plane.
//!
//! Phase 0: in-process counters + histograms. Future phases will connect
//! to an OTLP exporter.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

/// Lightweight executor metrics collector.
///
/// Tracks request count, error count, and latency histogram buckets.
/// The public API is the [`record`](ExecutorMetrics::record) method called
/// after each [`ProviderExecutor::execute`](crate::ProviderExecutor::execute).
#[derive(Debug)]
pub struct ExecutorMetrics {
    /// Total requests dispatched.
    pub total: AtomicU64,
    /// Non-2xx responses.
    pub errors: AtomicU64,
    /// Latency summation in microseconds (for computing average).
    latency_us: AtomicU64,
}

impl ExecutorMetrics {
    /// Create a new metrics collector with zeroed counters.
    pub fn new() -> Self {
        Self {
            total: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            latency_us: AtomicU64::new(0),
        }
    }

    /// Record a request outcome.
    pub fn record(&self, status: u16, latency: Duration) {
        self.total.fetch_add(1, Ordering::Relaxed);
        if !(200..300).contains(&status) {
            self.errors.fetch_add(1, Ordering::Relaxed);
        }
        self.latency_us
            .fetch_add(latency.as_micros() as u64, Ordering::Relaxed);
    }

    // -- Accessors (for dashboards, not hot-path) --

    /// Total dispatched requests.
    pub fn total(&self) -> u64 {
        self.total.load(Ordering::Relaxed)
    }

    /// Total errored requests.
    pub fn errors(&self) -> u64 {
        self.errors.load(Ordering::Relaxed)
    }

    /// Average latency in milliseconds.
    pub fn avg_latency_ms(&self) -> f64 {
        let t = self.total();
        if t == 0 {
            return 0.0;
        }
        (self.latency_us.load(Ordering::Relaxed) as f64 / t as f64) / 1000.0
    }
}

impl Default for ExecutorMetrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn starts_at_zero() {
        let m = ExecutorMetrics::new();
        assert_eq!(m.total(), 0);
        assert_eq!(m.errors(), 0);
        assert!(m.avg_latency_ms() < 0.001);
    }

    #[test]
    fn records_success() {
        let m = ExecutorMetrics::new();
        m.record(200, Duration::from_millis(100));
        assert_eq!(m.total(), 1);
        assert_eq!(m.errors(), 0);
        assert!((m.avg_latency_ms() - 100.0).abs() < 0.01);
    }

    #[test]
    fn records_error() {
        let m = ExecutorMetrics::new();
        m.record(500, Duration::from_millis(50));
        assert_eq!(m.total(), 1);
        assert_eq!(m.errors(), 1);
    }

    #[test]
    fn records_average() {
        let m = ExecutorMetrics::new();
        m.record(200, Duration::from_millis(100));
        m.record(200, Duration::from_millis(200));
        assert!((m.avg_latency_ms() - 150.0).abs() < 0.01);
    }

    #[test]
    fn arc_thread_safe() {
        let m = Arc::new(ExecutorMetrics::new());
        let m2 = m.clone();
        std::thread::spawn(move || {
            m2.record(200, Duration::from_millis(10));
        })
        .join()
        .unwrap();
        assert_eq!(m.total(), 1);
    }
}
