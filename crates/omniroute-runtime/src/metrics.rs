//! Minimal Prometheus text-format metrics + per-provider circuit breaker.
//!
//! ## Design constraints
//!
//! - **No new crate deps.** Hand-rolled text format emitter (Prometheus 0.0.4
//!   exposition spec). Keeps the data-plane binary small and the build hermetic.
//! - **Lock-free hot path.** Counters / gauges use atomics. Histograms use
//!   `AtomicU64` per bucket.
//! - **Per-provider isolation.** Each provider has its own [`CircuitBreaker`]
//!   instance so a failing Anthropic does not affect OpenAI.
//!
//! ## Metric surface (initial)
//!
//! | Metric                              | Type      | Labels           |
//! |-------------------------------------|-----------|------------------|
//! | `omniroute_requests_total`          | counter   | provider, status |
//! | `omniroute_request_errors_total`    | counter   | provider, kind   |
//! | `omniroute_request_duration_seconds`| histogram | (none, global)   |
//! | `omniroute_circuit_state`           | gauge     | provider         |
//! | `omniroute_active_requests`         | gauge     | provider         |

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use hyper::body::Bytes;
use hyper::Response;
use http_body_util::Full;

use crate::ResponseBody;

// ─── Counters ─────────────────────────────────────────────────────────────

#[derive(Debug)]
struct Counter {
    name: String,
    help: String,
    values: Mutex<BTreeMap<Vec<String>, Arc<AtomicU64>>>,
}

impl Counter {
    fn new(name: impl Into<String>, help: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            help: help.into(),
            values: Mutex::new(BTreeMap::new()),
        }
    }

    fn inc_by(&self, labels: &[&str], delta: u64) {
        let key: Vec<String> = labels.iter().map(|s| s.to_string()).collect();
        {
            let map = self.values.lock().expect("counter poisoned");
            if let Some(v) = map.get(&key) {
                v.fetch_add(delta, Ordering::Relaxed);
                return;
            }
        }
        let mut map = self.values.lock().expect("counter poisoned");
        let entry = map
            .entry(key)
            .or_insert_with(|| Arc::new(AtomicU64::new(0)));
        entry.fetch_add(delta, Ordering::Relaxed);
    }

    fn render(&self, label_names: &[&str]) -> String {
        let mut out = format!(
            "# HELP {} {}\n# TYPE {} counter\n",
            self.name, self.help, self.name
        );
        let map = self.values.lock().expect("counter poisoned");
        if map.is_empty() {
            out.push_str(&format!("{} 0\n", self.name));
            return out;
        }
        for (labels, value) in map.iter() {
            let label_refs: Vec<&str> = labels.iter().map(|s| s.as_str()).collect();
            let label_str = render_label_pair(label_names, &label_refs);
            out.push_str(&format!(
                "{}{{{}}} {}\n",
                self.name,
                label_str,
                value.load(Ordering::Relaxed)
            ));
        }
        out
    }
}

// ─── Histogram ────────────────────────────────────────────────────────────

#[derive(Debug)]
struct Histogram {
    name: String,
    help: String,
    buckets: Vec<f64>,
    bucket_counts: Vec<AtomicU64>,
    count: AtomicU64,
    sum: Mutex<f64>,
}

impl Histogram {
    fn new(name: impl Into<String>, help: impl Into<String>, buckets: Vec<f64>) -> Self {
        let bucket_counts = buckets.iter().map(|_| AtomicU64::new(0)).collect();
        Self {
            name: name.into(),
            help: help.into(),
            buckets,
            bucket_counts,
            count: AtomicU64::new(0),
            sum: Mutex::new(0.0),
        }
    }

    fn observe(&self, value: f64) {
        for (i, b) in self.buckets.iter().enumerate() {
            if value <= *b {
                self.bucket_counts[i].fetch_add(1, Ordering::Relaxed);
            }
        }
        self.count.fetch_add(1, Ordering::Relaxed);
        *self.sum.lock().expect("histogram sum poisoned") += value;
    }

    fn render(&self, label_names: &[&str], labels: &[&str]) -> String {
        let label_str = render_label_pair(label_names, labels);
        let mut out = format!(
            "# HELP {} {}\n# TYPE {} histogram\n",
            self.name, self.help, self.name
        );
        for (i, b) in self.buckets.iter().enumerate() {
            // Format bucket as f64 with consistent precision so labels
            // emit "1.0" not "1" — Prometheus parsers prefer string consistency.
            let bucket_label = if b.fract() == 0.0 {
                format!("{}.0", b)
            } else {
                format!("{}", b)
            };
            let bucket_labels = format!(
                "{}{{{},le=\"{}\"}}",
                self.name,
                label_str,
                bucket_label
            );
            out.push_str(&format!(
                "{} {}\n",
                bucket_labels,
                self.bucket_counts[i].load(Ordering::Relaxed)
            ));
        }
        out.push_str(&format!(
            "{}{{{},le=\"+Inf\"}} {}\n",
            self.name,
            label_str,
            self.count.load(Ordering::Relaxed)
        ));
        out.push_str(&format!(
            "{}_sum {}\n",
            self.name,
            *self.sum.lock().expect("histogram sum poisoned")
        ));
        out.push_str(&format!(
            "{}_count {}\n",
            self.name,
            self.count.load(Ordering::Relaxed)
        ));
        out
    }
}

// ─── Gauge (per-provider) ────────────────────────────────────────────────

#[derive(Debug)]
struct GaugeSet {
    name: String,
    help: String,
    values: Mutex<BTreeMap<String, Arc<AtomicI64>>>,
}

impl GaugeSet {
    fn new(name: impl Into<String>, help: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            help: help.into(),
            values: Mutex::new(BTreeMap::new()),
        }
    }

    fn set(&self, provider: &str, value: i64) {
        let mut map = self.values.lock().expect("gauge poisoned");
        let entry = map
            .entry(provider.to_string())
            .or_insert_with(|| Arc::new(AtomicI64::new(0)));
        entry.store(value, Ordering::Relaxed);
    }

    fn render(&self) -> String {
        let mut out = format!(
            "# HELP {} {}\n# TYPE {} gauge\n",
            self.name, self.help, self.name
        );
        let map = self.values.lock().expect("gauge poisoned");
        for (provider, value) in map.iter() {
            out.push_str(&format!(
                "{}{{provider=\"{}\"}} {}\n",
                self.name,
                escape_label_value(provider),
                value.load(Ordering::Relaxed)
            ));
        }
        out
    }
}

// ─── Metrics ──────────────────────────────────────────────────────────────

/// Aggregate metrics handle, cloned per request.
#[derive(Debug, Clone)]
pub struct Metrics {
    inner: Arc<MetricsInner>,
}

/// Convenience alias for the shared metrics handle exposed via [`Server::metrics`].
pub type SharedMetrics = Metrics;

#[derive(Debug)]
struct MetricsInner {
    requests: Counter,
    errors: Counter,
    duration: Histogram,
    circuit_state: GaugeSet,
    active_requests: GaugeSet,
}

impl Metrics {
    /// Create the default metrics set with sensible histogram buckets.
    pub fn new() -> Self {
        Self {
            inner: Arc::new(MetricsInner {
                requests: Counter::new(
                    "omniroute_requests_total",
                    "Total chat completion requests by provider and HTTP status class.",
                ),
                errors: Counter::new(
                    "omniroute_request_errors_total",
                    "Total errors by provider and error kind.",
                ),
                duration: Histogram::new(
                    "omniroute_request_duration_seconds",
                    "Chat completion request duration in seconds.",
                    vec![0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
                ),
                circuit_state: GaugeSet::new(
                    "omniroute_circuit_state",
                    "Circuit breaker state per provider: 0=closed, 1=half-open, 2=open.",
                ),
                active_requests: GaugeSet::new(
                    "omniroute_active_requests",
                    "In-flight chat completion requests per provider.",
                ),
            }),
        }
    }

    pub fn record_request(&self, provider: &str, status_class: &str, duration_secs: f64) {
        self.inner.requests.inc_by(&[provider, status_class], 1);
        self.inner.duration.observe(duration_secs);
    }

    pub fn record_error(&self, provider: &str, kind: &str) {
        self.inner.errors.inc_by(&[provider, kind], 1);
    }

    pub fn active_inc(&self, provider: &str) {
        bump_gauge(&self.inner.active_requests, provider, 1);
    }

    pub fn active_dec(&self, provider: &str) {
        bump_gauge(&self.inner.active_requests, provider, -1);
    }

    pub fn set_circuit_state(&self, provider: &str, state: CircuitState) {
        self.inner.circuit_state.set(provider, state.as_i64());
    }

    /// Render the metrics in Prometheus text exposition format.
    pub fn render(&self) -> String {
        let mut out = String::with_capacity(2048);
        out.push_str(&self.inner.requests.render(&["provider", "status"]));
        out.push_str(&self.inner.errors.render(&["provider", "kind"]));
        out.push_str(&self.inner.duration.render(&[], &[]));
        out.push_str(&self.inner.circuit_state.render());
        out.push_str(&self.inner.active_requests.render());
        out
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

fn bump_gauge(g: &GaugeSet, provider: &str, delta: i64) {
    let mut map = g.values.lock().expect("gauge poisoned");
    let entry = map
        .entry(provider.to_string())
        .or_insert_with(|| Arc::new(AtomicI64::new(0)));
    entry.fetch_add(delta, Ordering::Relaxed);
}

fn render_label_pair(names: &[&str], values: &[&str]) -> String {
    if names.is_empty() {
        return String::new();
    }
    let parts: Vec<String> = names
        .iter()
        .zip(values.iter())
        .map(|(n, v)| format!("{n}=\"{}\"", escape_label_value(v)))
        .collect();
    parts.join(",")
}

fn escape_label_value(v: &str) -> String {
    v.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

// ─── Circuit breaker ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    HalfOpen,
    Open,
}

impl CircuitState {
    fn as_i64(self) -> i64 {
        match self {
            CircuitState::Closed => 0,
            CircuitState::HalfOpen => 1,
            CircuitState::Open => 2,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CircuitConfig {
    pub failure_threshold: u32,
    pub open_cooldown: Duration,
}

impl Default for CircuitConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 10,
            open_cooldown: Duration::from_secs(30),
        }
    }
}

#[derive(Debug)]
pub struct CircuitBreaker {
    provider: String,
    config: CircuitConfig,
    state: Mutex<CircuitState>,
    consecutive_failures: AtomicU64,
    opened_at: Mutex<Option<Instant>>,
}

impl CircuitBreaker {
    pub fn new(provider: impl Into<String>, config: CircuitConfig) -> Self {
        Self {
            provider: provider.into(),
            config,
            state: Mutex::new(CircuitState::Closed),
            consecutive_failures: AtomicU64::new(0),
            opened_at: Mutex::new(None),
        }
    }

    pub fn state(&self) -> CircuitState {
        let mut state = self.state.lock().expect("circuit state poisoned");
        if matches!(*state, CircuitState::Open) {
            let opened = self.opened_at.lock().expect("opened_at poisoned");
            if let Some(t) = *opened {
                if t.elapsed() >= self.config.open_cooldown {
                    *state = CircuitState::HalfOpen;
                }
            }
        }
        *state
    }

    pub fn try_admit(&self) -> Result<(), CircuitOpen> {
        match self.state() {
            CircuitState::Closed | CircuitState::HalfOpen => Ok(()),
            CircuitState::Open => Err(CircuitOpen {
                provider: self.provider.clone(),
                cooldown_ms: self
                    .opened_at
                    .lock()
                    .expect("opened_at poisoned")
                    .map(|t| {
                        let elapsed = t.elapsed();
                        if elapsed >= self.config.open_cooldown {
                            0
                        } else {
                            (self.config.open_cooldown - elapsed).as_millis() as u64
                        }
                    })
                    .unwrap_or(0),
            }),
        }
    }

    pub fn record_success(&self) {
        self.consecutive_failures.store(0, Ordering::Relaxed);
        let mut state = self.state.lock().expect("circuit state poisoned");
        if !matches!(*state, CircuitState::Closed) {
            *state = CircuitState::Closed;
            *self.opened_at.lock().expect("opened_at poisoned") = None;
        }
    }

    pub fn record_failure(&self) {
        let n = self.consecutive_failures.fetch_add(1, Ordering::Relaxed) + 1;
        let mut state = self.state.lock().expect("circuit state poisoned");
        match *state {
            CircuitState::Closed if n >= self.config.failure_threshold as u64 => {
                *state = CircuitState::Open;
                *self.opened_at.lock().expect("opened_at poisoned") = Some(Instant::now());
            }
            CircuitState::HalfOpen => {
                *state = CircuitState::Open;
                *self.opened_at.lock().expect("opened_at poisoned") = Some(Instant::now());
            }
            _ => {}
        }
    }
}

#[derive(Debug, Clone, thiserror::Error)]
#[error("circuit open for provider {provider}, retry after {cooldown_ms}ms")]
pub struct CircuitOpen {
    pub provider: String,
    pub cooldown_ms: u64,
}

#[derive(Debug)]
pub struct CircuitRegistry {
    inner: Mutex<BTreeMap<String, Arc<CircuitBreaker>>>,
    config: CircuitConfig,
}

impl CircuitRegistry {
    pub fn new(config: CircuitConfig) -> Self {
        Self {
            inner: Mutex::new(BTreeMap::new()),
            config,
        }
    }

    pub fn for_provider(&self, provider: &str) -> Arc<CircuitBreaker> {
        {
            let map = self.inner.lock().expect("circuit registry poisoned");
            if let Some(b) = map.get(provider) {
                return b.clone();
            }
        }
        let mut map = self.inner.lock().expect("circuit registry poisoned");
        map.entry(provider.to_string())
            .or_insert_with(|| Arc::new(CircuitBreaker::new(provider, self.config.clone())))
            .clone()
    }

    pub fn iter(&self) -> Vec<(String, Arc<CircuitBreaker>)> {
        self.inner
            .lock()
            .expect("circuit registry poisoned")
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }
}

impl Default for CircuitRegistry {
    fn default() -> Self {
        Self::new(CircuitConfig::default())
    }
}

// ─── HTTP endpoint helper ─────────────────────────────────────────────────

/// Build the `GET /metrics` HTTP response.
pub fn metrics_endpoint(metrics: &SharedMetrics) -> Response<ResponseBody> {
    let body = metrics.render();
    Response::builder()
        .status(200)
        .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
        .body(Full::new(Bytes::from(body)))
        .expect("static response")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counter_inc_and_render() {
        let m = Metrics::new();
        m.record_request("openai", "200", 0.123);
        m.record_request("openai", "200", 0.234);
        m.record_request("anthropic", "5xx", 1.5);
        let out = m.render();
        assert!(out.contains("omniroute_requests_total"));
        assert!(out.contains("provider=\"openai\""));
        assert!(out.contains("status=\"200\""));
        assert!(out.contains("provider=\"anthropic\""));
        assert!(out.contains("status=\"5xx\""));
    }

    #[test]
    fn histogram_observes_into_buckets() {
        let h = Histogram::new("test", "t", vec![0.1, 0.5, 1.0]);
        h.observe(0.05);
        h.observe(0.2);
        h.observe(0.7);
        h.observe(5.0);
        let r = h.render(&[], &[]);
        assert!(r.contains(r#"le="0.1"} 1"#));
        assert!(r.contains("le=\"0.5\"} 2"));
        assert!(r.contains("le=\"1.0\"} 3"));
        assert!(r.contains("le=\"+Inf\"} 4"));
    }

    #[test]
    fn gauge_set_and_render() {
        let g = GaugeSet::new("test", "t");
        g.set("openai", 7);
        g.set("anthropic", -3);
        let r = g.render();
        assert!(r.contains("provider=\"openai\"} 7"));
        assert!(r.contains("provider=\"anthropic\"} -3"));
    }

    #[test]
    fn circuit_breaker_trips_after_threshold() {
        let cb = CircuitBreaker::new("openai", CircuitConfig {
            failure_threshold: 3,
            open_cooldown: Duration::from_secs(60),
        });
        assert_eq!(cb.state(), CircuitState::Closed);
        cb.record_failure();
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Closed);
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(cb.try_admit().is_err());
    }

    #[test]
    fn circuit_breaker_resets_on_success() {
        let cb = CircuitBreaker::new("openai", CircuitConfig {
            failure_threshold: 5,
            open_cooldown: Duration::from_secs(60),
        });
        cb.record_failure();
        cb.record_failure();
        cb.record_success();
        assert_eq!(cb.consecutive_failures.load(Ordering::Relaxed), 0);
        assert_eq!(cb.state(), CircuitState::Closed);
    }

    #[test]
    fn circuit_breaker_half_open_after_cooldown() {
        let cb = CircuitBreaker::new("openai", CircuitConfig {
            failure_threshold: 1,
            open_cooldown: Duration::from_millis(10),
        });
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
        std::thread::sleep(Duration::from_millis(20));
        assert_eq!(cb.state(), CircuitState::HalfOpen);
        assert!(cb.try_admit().is_ok());
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
    }

    #[test]
    fn circuit_registry_returns_same_breaker() {
        let reg = CircuitRegistry::new(CircuitConfig::default());
        let a = reg.for_provider("openai");
        let b = reg.for_provider("openai");
        let c = reg.for_provider("anthropic");
        assert!(Arc::ptr_eq(&a, &b));
        assert!(!Arc::ptr_eq(&a, &c));
    }

    #[test]
    fn label_value_escape() {
        assert_eq!(escape_label_value("a\"b"), "a\\\"b");
        assert_eq!(escape_label_value("a\nb"), "a\\nb");
    }

    #[test]
    fn metrics_render_is_text_format() {
        let m = Metrics::new();
        m.record_request("openai", "200", 0.123);
        let out = m.render();
        assert!(out.contains("# HELP omniroute_requests_total"));
        assert!(out.contains("# TYPE omniroute_requests_total counter"));
        assert!(out.contains("# HELP omniroute_request_duration_seconds"));
        assert!(out.contains("# TYPE omniroute_request_duration_seconds histogram"));
        assert!(out.contains("# TYPE omniroute_circuit_state gauge"));
        assert!(out.contains("_sum "));
        assert!(out.contains("_count "));
    }

    #[test]
    fn metrics_render_active_requests_inc_dec() {
        let m = Metrics::new();
        m.active_inc("openai");
        m.active_inc("openai");
        m.active_dec("openai");
        let out = m.render();
        // Two inc, one dec → 1 in flight
        assert!(out.contains("omniroute_active_requests{provider=\"openai\"} 1"));
    }
}