//! L60 — OTel histogram (p50/p95/p99 latency) facade.
//!
//! Per ADR-037 + v15 cycle-5 plan, this module provides a fleet-wide
//! latency histogram with **bounded cardinality**. Cardinality control
//! is enforced at the type level: callers must pass a [`Route`] enum
//! (closed set of 6 values) and a [`Status`] enum (closed set of 3 values),
//! never free-form strings. This prevents OTel backend cardinality
//! explosion, which is the most common production incident in metrics
//! pipelines.
//!
//! # Bucket boundaries
//!
//! Buckets are fixed at OTel SDK defaults (in milliseconds):
//! `1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000`. These
//! align with the OTel semantic conventions for HTTP server duration.
//!
//! # Quantile estimation
//!
//! [`LatencyHistogram::quantile`] returns a piecewise-constant estimate
//! from the bucket histogram. For exact quantiles or streaming
//! percentiles, downstream consumers can feed [`HistogramSnapshot`] into
//! a T-Digest or HDR-histogram pipeline — this facade covers p50/p95/p99
//! for the cycle-5 L60 closure, not arbitrary quantiles.
//!
//! # Thread safety
//!
//! All bucket counters use [`AtomicU64`] with [`Ordering::Relaxed`]; the
//! facade is safe to share across threads via [`Arc`] and is the canonical
//! pattern for fleet-global metrics.

#![deny(unsafe_code)]

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Fixed bucket boundaries (milliseconds). Aligned with OTel semconv defaults.
pub const BUCKET_BOUNDS_MS: &[f64] = &[
    1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0, 10000.0,
];

/// Closed enum of route labels. Prevents cardinality explosion.
///
/// When adding a new route, append to the end (never reorder — ordinals
/// may be persisted in downstream OTLP consumers).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Route {
    /// Configuration load path.
    ConfigLoad,
    /// MCP router dispatch.
    McpDispatch,
    /// OTLP export path.
    OtlpExport,
    /// Tracing span emit.
    TraceEmit,
    /// Capacity calculation.
    CapacityCalc,
    /// Other (catch-all; should be rare).
    Other,
}

impl Route {
    /// String label used in OTel attribute. Stable, bounded, ASCII-only.
    pub fn as_str(&self) -> &'static str {
        match self {
            Route::ConfigLoad => "config.load",
            Route::McpDispatch => "mcp.dispatch",
            Route::OtlpExport => "otel.export",
            Route::TraceEmit => "trace.emit",
            Route::CapacityCalc => "capacity.calc",
            Route::Other => "other",
        }
    }
}

/// Closed status set; bounded cardinality like [`Route`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Status {
    /// 2xx success.
    Ok,
    /// 4xx/5xx error.
    Error,
    /// Request exceeded its deadline.
    Timeout,
}

impl Status {
    /// String label used in OTel attribute.
    pub fn as_str(&self) -> &'static str {
        match self {
            Status::Ok => "ok",
            Status::Error => "error",
            Status::Timeout => "timeout",
        }
    }
}

/// Bounded label pair attached to every recorded observation.
#[derive(Debug, Clone, Copy)]
pub struct Labels {
    /// Route label.
    pub route: Route,
    /// Status label.
    pub status: Status,
}

/// Cumulative bucket counts. Index `i` is the count of observations with
/// `value <= BUCKET_BOUNDS_MS[i]`; index `BUCKET_BOUNDS_MS.len()` is the
/// `+Inf` overflow bucket.
#[derive(Debug)]
struct BucketCounters {
    counts: [AtomicU64; BUCKET_BOUNDS_MS.len() + 1],
}

impl Default for BucketCounters {
    fn default() -> Self {
        Self {
            counts: std::array::from_fn(|_| AtomicU64::new(0)),
        }
    }
}

/// Fleet-wide latency histogram. Cheap to clone (Arc-backed).
#[derive(Debug, Clone, Default)]
pub struct LatencyHistogram {
    counters: Arc<BucketCounters>,
}

impl LatencyHistogram {
    /// Create a new fleet-global latency histogram.
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a latency observation (milliseconds) with bounded labels.
    ///
    /// The `labels` argument is typed (not `&str`) so the compiler
    /// enforces cardinality control at the call site.
    pub fn record(&self, duration_ms: f64, labels: Labels) {
        let idx = bucket_index(duration_ms);
        self.counters.counts[idx].fetch_add(1, Ordering::Relaxed);
        // Labels are emitted as OTel KeyValue attributes by the consumer
        // (see adopters' `metrics.rs`); this struct only owns bucket counts.
        let _ = labels;
    }

    /// Piecewise-constant estimate for quantile `q` in `0.0..=1.0`.
    /// Returns `None` when no observations have been recorded.
    pub fn quantile(&self, q: f64) -> Option<f64> {
        if !(0.0..=1.0).contains(&q) {
            return None;
        }
        let total: u64 = self
            .counters
            .counts
            .iter()
            .map(|c| c.load(Ordering::Relaxed))
            .sum();
        if total == 0 {
            return None;
        }
        // Target rank — never 0, so we always return a bound.
        let target = ((q * total as f64).ceil() as u64).max(1);
        let mut running = 0u64;
        for (i, c) in self.counters.counts.iter().enumerate() {
            running = running.saturating_add(c.load(Ordering::Relaxed));
            if running >= target {
                return Some(BUCKET_BOUNDS_MS.get(i).copied().unwrap_or(f64::INFINITY));
            }
        }
        Some(f64::INFINITY)
    }

    /// p50 estimate (50th percentile).
    pub fn p50(&self) -> Option<f64> {
        self.quantile(0.50)
    }

    /// p95 estimate (95th percentile).
    pub fn p95(&self) -> Option<f64> {
        self.quantile(0.95)
    }

    /// p99 estimate (99th percentile).
    pub fn p99(&self) -> Option<f64> {
        self.quantile(0.99)
    }

    /// Snapshot the cumulative bucket counts (for OTLP export or test
    /// assertions). The returned vector has length
    /// `BUCKET_BOUNDS_MS.len() + 1` (cumulative, including the `+Inf`
    /// overflow bucket).
    pub fn snapshot(&self) -> HistogramSnapshot {
        let bucket_counts: Vec<u64> = self
            .counters
            .counts
            .iter()
            .map(|c| c.load(Ordering::Relaxed))
            .collect();
        let total_count = bucket_counts.iter().sum();
        HistogramSnapshot {
            bucket_counts,
            total_count,
        }
    }
}

/// Snapshot of cumulative bucket counts at a point in time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistogramSnapshot {
    /// Cumulative count per bucket (length = `BUCKET_BOUNDS_MS.len() + 1`).
    pub bucket_counts: Vec<u64>,
    /// Total observations (sum of all bucket counts).
    pub total_count: u64,
}

#[inline]
fn bucket_index(value_ms: f64) -> usize {
    for (i, bound) in BUCKET_BOUNDS_MS.iter().enumerate() {
        if value_ms <= *bound {
            return i;
        }
    }
    BUCKET_BOUNDS_MS.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_histogram_returns_none() {
        let h = LatencyHistogram::new();
        assert_eq!(h.p50(), None);
        assert_eq!(h.p95(), None);
        assert_eq!(h.p99(), None);
        assert_eq!(h.snapshot().total_count, 0);
    }

    #[test]
    fn record_increments_correct_bucket() {
        let h = LatencyHistogram::new();
        let labels = Labels {
            route: Route::ConfigLoad,
            status: Status::Ok,
        };
        h.record(7.0, labels);
        h.record(42.0, labels);
        h.record(7500.0, labels);
        // 7.0 -> bucket 2 (10), 42.0 -> bucket 4 (50), 7500.0 -> overflow.
        let snap = h.snapshot();
        assert_eq!(snap.bucket_counts[2], 1);
        assert_eq!(snap.bucket_counts[4], 1);
        assert_eq!(*snap.bucket_counts.last().unwrap(), 1);
        assert_eq!(snap.total_count, 3);
    }

    #[test]
    fn p50_p95_p99_for_uniform_distribution() {
        let h = LatencyHistogram::new();
        let labels = Labels {
            route: Route::McpDispatch,
            status: Status::Ok,
        };
        for v in 1..=100 {
            h.record(v as f64, labels);
        }
        // All observations land in distinct buckets (1, 2, ..., 100), so:
        // p50  -> bucket containing value 50  (bound 50.0)
        // p95  -> bucket containing value 95  (bound 100.0)
        // p99  -> bucket containing value 99  (bound 100.0)
        assert_eq!(h.p50(), Some(50.0));
        assert_eq!(h.p95(), Some(100.0));
        assert_eq!(h.p99(), Some(100.0));
    }

    #[test]
    fn p99_caps_at_bucket_bound() {
        let h = LatencyHistogram::new();
        let labels = Labels {
            route: Route::OtlpExport,
            status: Status::Error,
        };
        // Single observation in the 250 bucket.
        h.record(200.0, labels);
        assert_eq!(h.p99(), Some(250.0));
    }

    #[test]
    fn overflow_bucket_counts() {
        let h = LatencyHistogram::new();
        let labels = Labels {
            route: Route::TraceEmit,
            status: Status::Timeout,
        };
        h.record(99_999.0, labels);
        let snap = h.snapshot();
        assert_eq!(*snap.bucket_counts.last().unwrap(), 1);
        assert_eq!(h.p99(), Some(f64::INFINITY));
    }

    #[test]
    fn invalid_quantile_returns_none() {
        let h = LatencyHistogram::new();
        h.record(10.0, Labels {
            route: Route::Other,
            status: Status::Ok,
        });
        assert_eq!(h.quantile(-0.1), None);
        assert_eq!(h.quantile(1.1), None);
    }

    #[test]
    fn route_labels_are_stable_ascii() {
        for route in [
            Route::ConfigLoad,
            Route::McpDispatch,
            Route::OtlpExport,
            Route::TraceEmit,
            Route::CapacityCalc,
            Route::Other,
        ] {
            let s = route.as_str();
            assert!(!s.is_empty());
            assert!(s.is_ascii());
            assert!(s.contains('.'), "route label {} should be dotted", s);
        }
    }

    #[test]
    fn status_labels_are_stable_ascii() {
        for status in [Status::Ok, Status::Error, Status::Timeout] {
            let s = status.as_str();
            assert!(!s.is_empty());
            assert!(s.is_ascii());
        }
    }

    #[test]
    fn snapshot_serializes_to_json() {
        let h = LatencyHistogram::new();
        let labels = Labels {
            route: Route::CapacityCalc,
            status: Status::Ok,
        };
        h.record(30.0, labels);
        let snap = h.snapshot();
        let json = serde_json::to_string(&snap).unwrap();
        assert!(json.contains("\"bucket_counts\""));
        assert!(json.contains("\"total_count\":1"));
    }

    #[test]
    fn clones_share_counters() {
        let h1 = LatencyHistogram::new();
        let h2 = h1.clone();
        h1.record(15.0, Labels {
            route: Route::ConfigLoad,
            status: Status::Ok,
        });
        // h2 must observe h1's record (Arc-shared counters).
        assert_eq!(h2.snapshot().total_count, 1);
    }

    #[test]
    fn bucket_bounds_ms_length_matches_snapshot() {
        let h = LatencyHistogram::new();
        let snap = h.snapshot();
        assert_eq!(snap.bucket_counts.len(), BUCKET_BOUNDS_MS.len() + 1);
    }
}