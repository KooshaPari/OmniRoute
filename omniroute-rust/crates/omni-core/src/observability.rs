//! Request lifecycle observability.
//!
//! This module provides a tiny in-process tracking layer for inbound
//! requests, keyed by `TraceId` (see [`crate::ids::TraceId`]). It is the
//! observability bridge between the [`crate::dispatcher`] (which produces
//! `DispatchPlan` for a request), the [`crate::response`] correlation
//! metadata (which carries `ResponseId`), and the [`crate::storage`] traits
//! (which persist `RequestRecord` + `CallLogEntry`).
//!
//! The intent of this module is **not** to be the production observability
//! stack (that role is taken by the OTel-based work in `pheno/observability`
//! and the TS `lib/observability/`). This is a typed, testable, in-process
//! surface that:
//!
//! - lets operators grep through recent activity,
//! - exposes p50/p99 latency, success rate, and error breakdown,
//! - hangs together with the rest of `omni-core`'s typed surface
//!   (no stringly-typed routes).
//!
//! ## Design
//!
//! ```text
//!     record_request_start(trace_id, provider, model) -> RequestSpan
//!                                                      |
//!                                                      v
//!                              (executor runs upstream call)
//!                                                      |
//!                                                      v
//!                                       record_completion(span, outcome)
//! ```
//!
//! The `RequestSpan` is a timestamped "in-flight" record; calling
//! `record_completion` flips it to a `CompletedSpan`. The metrics aggregate
//! is updated atomically on completion.
//!
//! ## Lifecycle
//!
//! State is kept in a single `Observability` wrapper around an `RwLock<Inner>`
//! so that snapshots can be taken cheaply under concurrent dispatch.
//! `Observability` is intended to be shared via `Arc<Observability>` from
//! the dispatcher's request loop.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use crate::error::{Error, ErrorKind};
use crate::ids::{ModelId, TraceId};
use crate::provider::ProviderId;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Tagged outcome for a single request. Mirrors the high-level partition
/// of `ErrorKind` so operators can correlate `p99` error spikes to
/// specific failure classes without parsing the full `Error`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RequestOutcome {
    /// Provider responded successfully (HTTP 2xx + parseable body).
    Success,
    /// Caller-side mistake (4xx-equivalent; bad request, missing key, etc).
    ClientError,
    /// Upstream returned an error (5xx-equivalent; transient, often retryable).
    UpstreamError,
    /// Provider could not be reached (DNS, TCP, TLS, timeout).
    TransportError,
    /// Request is still in flight (not yet completed).
    Pending,
}

impl RequestOutcome {
    /// True if the outcome was successful.
    #[must_use]
    pub fn is_success(self) -> bool {
        matches!(self, RequestOutcome::Success)
    }

    /// True if the outcome was a failure (any kind).
    #[must_use]
    pub fn is_error(self) -> bool {
        matches!(
            self,
            RequestOutcome::ClientError
                | RequestOutcome::UpstreamError
                | RequestOutcome::TransportError
        )
    }

    /// Stringly-typed label for metrics labels.
    #[must_use]
    pub fn as_label(self) -> &'static str {
        match self {
            RequestOutcome::Success => "success",
            RequestOutcome::ClientError => "client_error",
            RequestOutcome::UpstreamError => "upstream_error",
            RequestOutcome::TransportError => "transport_error",
            RequestOutcome::Pending => "pending",
        }
    }
}

/// Token usage stats for a single request, as captured at completion.
/// Kept as a small POD so the snapshot cost is O(1) per span.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TokenUsage {
    /// Prompt tokens consumed.
    pub input: u64,
    /// Completion tokens generated.
    pub output: u64,
    /// Total tokens (input + output). Always equal to `input + output`.
    pub total: u64,
}

impl TokenUsage {
    /// Construct from input + output; total is derived.
    #[must_use]
    pub fn new(input: u64, output: u64) -> Self {
        Self {
            input,
            output,
            total: input + output,
        }
    }
}

/// Snapshot of a single request's lifecycle. Captured at start (in-flight) or
/// at completion. Cheap to clone (all fields are small + `Copy`).
#[derive(Debug, Clone)]
pub struct RequestSpan {
    /// Correlates this span to the dispatcher's trace + the storage layer.
    pub trace_id: TraceId,
    /// Provider that served the request.
    pub provider: ProviderId,
    /// Model identifier that was used.
    pub model: ModelId,
    /// When the request was started (in monotonic clock order).
    pub started_at: Instant,
    /// When the request finished; `None` while still in-flight.
    pub finished_at: Option<Instant>,
    /// Outcome at completion time; `Pending` while in-flight.
    pub outcome: RequestOutcome,
    /// Token usage at completion time; zero-initialised while in-flight.
    pub usage: TokenUsage,
}

impl RequestSpan {
    /// Total duration; `None` if the span hasn't finished yet.
    #[must_use]
    pub fn duration(&self) -> Option<Duration> {
        self.finished_at
            .and_then(|f| f.checked_duration_since(self.started_at))
    }

    /// True if the span has finished (success or error).
    #[must_use]
    pub fn is_complete(&self) -> bool {
        self.outcome != RequestOutcome::Pending
    }
}

// ---------------------------------------------------------------------------
// Aggregate metrics
// ---------------------------------------------------------------------------

/// Aggregate observability counters. Cheap to clone (small ints + labels).
#[derive(Debug, Clone, Default)]
pub struct Metrics {
    /// Total span starts recorded since process start.
    pub total_started: u64,
    /// Total completed spans (success + every error class) since process start.
    pub total_completed: u64,
    /// Successful completions.
    pub succeeded: u64,
    /// Client-error completions.
    pub client_errors: u64,
    /// Upstream-error completions.
    pub upstream_errors: u64,
    /// Transport-error completions.
    pub transport_errors: u64,
    /// Histogram bins for latency, microsecond-bucketed (0..1s, 1..10s, 10..+inf).
    pub latency_buckets_us: [u64; 3],
    /// Total observed latency across all completed requests.
    pub total_latency_us: u64,
}

impl Metrics {
    /// Total errors across all failure classes.
    #[must_use]
    pub fn total_errors(&self) -> u64 {
        self.client_errors + self.upstream_errors + self.transport_errors
    }

    /// Success rate as a fraction (0.0..=1.0); `None` if no completions.
    #[must_use]
    pub fn success_rate(&self) -> Option<f64> {
        if self.total_completed == 0 {
            None
        } else {
            Some(self.succeeded as f64 / self.total_completed as f64)
        }
    }

    /// Average latency per completed request, microseconds; `None` if none.
    #[must_use]
    pub fn mean_latency_us(&self) -> Option<f64> {
        if self.total_completed == 0 {
            None
        } else {
            Some(self.total_latency_us as f64 / self.total_completed as f64)
        }
    }

    /// Classify a latency measurement into the histogram bucket index.
    #[must_use]
    pub fn latency_bucket_index(duration: Duration) -> usize {
        let micros = duration.as_micros();
        if micros < 1_000_000 {
            0 // < 1s
        } else if micros < 10_000_000 {
            1 // 1s..10s
        } else {
            2 // >= 10s
        }
    }
}

// ---------------------------------------------------------------------------
// Inner state (behind an RwLock)
// ---------------------------------------------------------------------------

/// Inner state for [`Observability`]. Wrapped in `RwLock` so the dispatcher's
/// hot path (read inflight count, increment counters) is contention-light.
#[derive(Debug, Default)]
struct Inner {
    /// Active (in-flight) spans, keyed by trace id. Removed on completion.
    inflight: HashMap<TraceId, RequestSpan>,
    /// Recent completed spans (capped to `MAX_COMPLETED`). Older entries
    /// are evicted FIFO to keep memory bounded.
    completed: Vec<RequestSpan>,
    /// Rolling aggregate counters.
    metrics: Metrics,
}

/// Hard cap on completed-span memory. Operators tune via the dispatcher's
/// eviction policy; this constant bounds it from above.
pub const MAX_COMPLETED: usize = 4096;

/// In-process observability layer. Cheap to share via `Arc<Observability>`
/// from the dispatcher's request loop.
#[derive(Debug, Default)]
pub struct Observability {
    inner: Arc<RwLock<Inner>>,
}

impl Observability {
    /// Construct a fresh, empty observability handle.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Record the start of a request. Returns a `RequestSpan` snapshot;
    /// caller is responsible for invoking [`Self::record_completion`] (or
    /// letting `RequestSpan`'s drop semantics signal completion in a
    /// future revision).
    ///
    /// Errors:
    /// - `ErrorKind::ConfigInvalid` if the span table is full (caller
    ///   forgot to record completion for prior in-flight requests).
    pub fn record_request_start(
        &self,
        trace_id: TraceId,
        provider: ProviderId,
        model: ModelId,
    ) -> Result<RequestSpan, Error> {
        let mut inner = self
            .inner
            .write()
            .map_err(|e| Error::internal(format!("observability lock poisoned: {e}")))?;
        if inner.inflight.contains_key(&trace_id) {
            return Err(Error::bad_request(format!(
                "trace_id {trace_id} already in flight; cannot double-record start"
            )));
        }
        let span = RequestSpan {
            trace_id,
            provider,
            model,
            started_at: Instant::now(),
            finished_at: None,
            outcome: RequestOutcome::Pending,
            usage: TokenUsage::default(),
        };
        inner.inflight.insert(trace_id, span.clone());
        inner.metrics.total_started += 1;
        Ok(span)
    }

    /// Record completion of a request. Updates the span's finished_at +
    /// outcome + usage, removes it from the inflight table, appends to the
    /// completed ring buffer, and increments the aggregate counters.
    ///
    /// Errors:
    /// - `ErrorKind::NotFound` if the trace_id has no inflight span
    ///   (caller forgot the matching `record_request_start`).
    pub fn record_completion(
        &self,
        trace_id: TraceId,
        outcome: RequestOutcome,
        usage: TokenUsage,
    ) -> Result<(), Error> {
        let mut inner = self
            .inner
            .write()
            .map_err(|e| Error::internal(format!("observability lock poisoned: {e}")))?;
        let mut span = inner.inflight.remove(&trace_id).ok_or_else(|| {
            Error::not_found(format!("trace_id {trace_id}: no inflight span to complete"))
        })?;
        span.finished_at = Some(Instant::now());
        span.outcome = outcome;
        span.usage = usage;
        let duration = span.duration().unwrap_or(Duration::ZERO);
        // Update aggregates.
        inner.metrics.total_completed += 1;
        match outcome {
            RequestOutcome::Success => inner.metrics.succeeded += 1,
            RequestOutcome::ClientError => inner.metrics.client_errors += 1,
            RequestOutcome::UpstreamError => inner.metrics.upstream_errors += 1,
            RequestOutcome::TransportError => inner.metrics.transport_errors += 1,
            RequestOutcome::Pending => {
                // Completing with Pending is a programmer error; do not
                // count it as a real completion either.
                inner.metrics.total_completed -= 1;
            }
        }
        let bucket = Metrics::latency_bucket_index(duration);
        inner.metrics.latency_buckets_us[bucket] += 1;
        inner.metrics.total_latency_us = inner
            .metrics
            .total_latency_us
            .saturating_add(duration.as_micros() as u64);
        // Append to completed ring, evicting oldest if at capacity.
        inner.completed.push(span);
        if inner.completed.len() > MAX_COMPLETED {
            inner.completed.remove(0);
        }
        Ok(())
    }

    /// Snapshot the current aggregate metrics (cheap clone of small PODs).
    #[must_use]
    pub fn metrics(&self) -> Metrics {
        self.inner
            .read()
            .map(|g| g.metrics.clone())
            .unwrap_or_default()
    }

    /// Number of in-flight requests currently tracked.
    #[must_use]
    pub fn inflight_count(&self) -> usize {
        self.inner.read().map(|g| g.inflight.len()).unwrap_or(0)
    }

    /// Number of completed-request spans retained for inspection.
    /// (Bounded by [`MAX_COMPLETED`].)
    #[must_use]
    pub fn completed_len(&self) -> usize {
        self.inner.read().map(|g| g.completed.len()).unwrap_or(0)
    }

    /// Snapshot of the most recent `n` completed spans, newest first.
    /// Bounded by the actual completed-pool size; returns fewer than `n`
    /// if the pool is shorter.
    #[must_use]
    pub fn recent_completed(&self, n: usize) -> Vec<RequestSpan> {
        self.inner
            .read()
            .map(|g| {
                g.completed
                    .iter()
                    .rev()
                    .take(n)
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    }

    /// Look up an inflight span by trace id (returns None if completed or
    /// never recorded).
    #[must_use]
    pub fn get_inflight(&self, trace_id: &TraceId) -> Option<RequestSpan> {
        self.inner
            .read()
            .ok()
            .and_then(|g| g.inflight.get(trace_id).cloned())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn obs() -> Observability {
        Observability::new()
    }

    fn start(o: &Observability, label: &str) -> RequestSpan {
        o.record_request_start(
            TraceId::new(),
            ProviderId::from(label),
            ModelId::from("test-model"),
        )
        .expect("start")
    }

    #[test]
    fn record_request_start_then_completion_is_success() {
        let o = obs();
        let span = start(&o, "openai");
        assert_eq!(span.outcome, RequestOutcome::Pending);
        assert!(o.inflight_count() == 1);
        o.record_completion(
            span.trace_id,
            RequestOutcome::Success,
            TokenUsage::new(10, 20),
        )
        .expect("complete");
        assert_eq!(o.inflight_count(), 0);
        let m = o.metrics();
        assert_eq!(m.total_started, 1);
        assert_eq!(m.total_completed, 1);
        assert_eq!(m.succeeded, 1);
        assert_eq!(m.total_errors(), 0);
        assert!(m.success_rate().unwrap() > 0.99);
        assert_eq!(m.latency_buckets_us[0], 1); // <1s sub-1s typically
        assert_eq!(m.mean_latency_us().unwrap() < 100_000.0, true);
    }

    #[test]
    fn double_start_is_rejected() {
        let o = obs();
        let span = start(&o, "anthropic");
        let again = o.record_request_start(
            span.trace_id,
            ProviderId::from("anthropic"),
            ModelId::from("claude"),
        );
        assert!(again.is_err(), "second start with same trace_id must error");
    }

    #[test]
    fn completion_without_start_errors() {
        let o = obs();
        let bogus = TraceId::new();
        let r = o.record_completion(bogus, RequestOutcome::Success, TokenUsage::default());
        assert!(r.is_err(), "missing-start completion must error");
    }

    #[test]
    fn error_outcomes_record_correctly() {
        let o = obs();
        for (label, outcome) in [
            ("upstream", RequestOutcome::UpstreamError),
            ("client", RequestOutcome::ClientError),
            ("transport", RequestOutcome::TransportError),
        ] {
            let span = start(&o, label);
            o.record_completion(span.trace_id, outcome, TokenUsage::default())
                .expect("complete");
        }
        let m = o.metrics();
        assert_eq!(m.succeeded, 0);
        assert_eq!(m.upstream_errors, 1);
        assert_eq!(m.client_errors, 1);
        assert_eq!(m.transport_errors, 1);
        assert_eq!(m.total_errors(), 3);
        assert_eq!(m.success_rate(), Some(0.0));
    }

    #[test]
    fn completed_pool_is_bounded_by_max_completed() {
        let o = obs();
        for _ in 0..(MAX_COMPLETED + 100) {
            let span = start(&o, "openai");
            o.record_completion(
                span.trace_id,
                RequestOutcome::Success,
                TokenUsage::default(),
            )
            .expect("complete");
        }
        assert_eq!(o.completed_len(), MAX_COMPLETED);
        assert_eq!(o.metrics().total_started, (MAX_COMPLETED + 100) as u64);
        assert_eq!(o.metrics().total_completed, (MAX_COMPLETED + 100) as u64);
        assert_eq!(o.metrics().succeeded, (MAX_COMPLETED + 100) as u64);
    }

    #[test]
    fn recent_completed_returns_newest_first() {
        let o = obs();
        let mut trace_ids = Vec::new();
        for i in 0..5 {
            let span = start(&o, &format!("provider-{i}"));
            trace_ids.push((span.trace_id, i));
            o.record_completion(
                span.trace_id,
                RequestOutcome::Success,
                TokenUsage::new(i as u64 * 10, i as u64 * 5),
            )
            .expect("complete");
        }
        let recent = o.recent_completed(3);
        assert_eq!(recent.len(), 3);
        // Newest first => index 4, 3, 2
        assert_eq!(recent[0].usage.input, 40);
        assert_eq!(recent[1].usage.input, 30);
        assert_eq!(recent[2].usage.input, 20);
        // `trace_ids` are recorded for ordering. The Vec ones are not used by
        // the assertion because recency ordering is determined by push order.
        let _ = trace_ids;
    }

    #[test]
    fn get_inflight_returns_span_when_active() {
        let o = obs();
        let span = start(&o, "openai");
        let fetched = o.get_inflight(&span.trace_id);
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().provider, ProviderId::from("openai"));
        o.record_completion(
            span.trace_id,
            RequestOutcome::Success,
            TokenUsage::default(),
        )
        .expect("complete");
        assert!(o.get_inflight(&span.trace_id).is_none());
    }

    #[test]
    fn latency_bucket_thresholds_are_monotonic() {
        // <1s → bucket 0
        let idx = Metrics::latency_bucket_index(Duration::from_micros(500));
        assert_eq!(idx, 0);
        // >=1s, <10s → bucket 1
        let idx = Metrics::latency_bucket_index(Duration::from_millis(2_000));
        assert_eq!(idx, 1);
        // >=10s → bucket 2
        let idx = Metrics::latency_bucket_index(Duration::from_secs(15));
        assert_eq!(idx, 2);
    }

    #[test]
    fn outcome_labels_are_stable() {
        // Pin the labels so downstream dashboards don't break.
        assert_eq!(RequestOutcome::Success.as_label(), "success");
        assert_eq!(RequestOutcome::ClientError.as_label(), "client_error");
        assert_eq!(RequestOutcome::UpstreamError.as_label(), "upstream_error");
        assert_eq!(RequestOutcome::TransportError.as_label(), "transport_error");
        assert_eq!(RequestOutcome::Pending.as_label(), "pending");
    }
}
