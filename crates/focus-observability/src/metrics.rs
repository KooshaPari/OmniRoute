// SPDX-License-Identifier: MIT OR Apache-2.0

//! # Prometheus Metrics Registry
//!
//! In-memory metrics with Prometheus text format export via `/metrics` HTTP endpoint.
//! Counters and histograms are thread-safe and can be incremented from any span context.

use parking_lot::RwLock;
use prometheus::{
    HistogramVec, IntCounterVec, Registry,
};
use std::sync::Arc;
use tracing::error;

/// Global metrics registry (singleton).
static METRICS_INSTANCE: parking_lot::Mutex<Option<Arc<MetricsRegistry>>> =
    parking_lot::Mutex::new(None);

/// Thread-safe metrics registry.
pub struct MetricsRegistry {
    registry: Arc<RwLock<Registry>>,
    connector_syncs: IntCounterVec,
    rule_evaluations: IntCounterVec,
    audit_appends: IntCounterVec,
    sync_duration: HistogramVec,
    eval_duration: HistogramVec,
}

impl MetricsRegistry {
    /// Create a new metrics registry.
    pub fn new() -> anyhow::Result<Self> {
        let registry = Arc::new(RwLock::new(Registry::new()));

        let connector_syncs = IntCounterVec::new(
            prometheus::Opts::new(
                "connector_syncs_total",
                "Total connector sync operations",
            ),
            &["connector_id"],
        )?;

        let rule_evaluations = IntCounterVec::new(
            prometheus::Opts::new(
                "rule_evaluations_total",
                "Total rule evaluations",
            ),
            &["rule_id"],
        )?;

        let audit_appends = IntCounterVec::new(
            prometheus::Opts::new("audit_appends_total", "Total audit appends"),
            &["audit_type"],
        )?;

        let sync_duration = HistogramVec::new(
            prometheus::HistogramOpts::new(
                "connector_sync_duration_seconds",
                "Connector sync duration in seconds",
            ),
            &["connector_id"],
        )?;

        let eval_duration = HistogramVec::new(
            prometheus::HistogramOpts::new(
                "rule_eval_duration_seconds",
                "Rule evaluation duration in seconds",
            ),
            &["rule_id"],
        )?;

        // Register all metrics with the registry
        let r = registry.read();
        r.register(Box::new(connector_syncs.clone()))?;
        r.register(Box::new(rule_evaluations.clone()))?;
        r.register(Box::new(audit_appends.clone()))?;
        r.register(Box::new(sync_duration.clone()))?;
        r.register(Box::new(eval_duration.clone()))?;
        drop(r);

        Ok(Self {
            registry,
            connector_syncs,
            rule_evaluations,
            audit_appends,
            sync_duration,
            eval_duration,
        })
    }

    /// Get or initialize the global metrics registry singleton.
    pub fn global() -> Arc<Self> {
        let mut instance = METRICS_INSTANCE.lock();
        if let Some(metrics) = instance.as_ref() {
            Arc::clone(metrics)
        } else {
            match Self::new() {
                Ok(metrics) => {
                    let arc = Arc::new(metrics);
                    *instance = Some(Arc::clone(&arc));
                    arc
                }
                Err(e) => {
                    error!("failed to create global metrics registry: {}", e);
                    panic!("metrics registry initialization failed: {}", e);
                }
            }
        }
    }

    /// Increment connector sync counter.
    pub fn inc_connector_syncs(&self, connector_id: &str, amount: f64) {
        self.connector_syncs
            .with_label_values(&[connector_id])
            .inc_by((amount as u64).max(1));
    }

    /// Increment rule evaluation counter.
    pub fn inc_rule_evaluations(&self, rule_id: &str, amount: f64) {
        self.rule_evaluations
            .with_label_values(&[rule_id])
            .inc_by((amount as u64).max(1));
    }

    /// Increment audit append counter.
    pub fn inc_audit_appends(&self, audit_type: &str, amount: f64) {
        self.audit_appends
            .with_label_values(&[audit_type])
            .inc_by((amount as u64).max(1));
    }

    /// Record connector sync duration (in seconds).
    pub fn record_sync_duration(&self, connector_id: &str, duration_secs: f64) {
        self.sync_duration
            .with_label_values(&[connector_id])
            .observe(duration_secs);
    }

    /// Record rule evaluation duration (in seconds).
    pub fn record_eval_duration(&self, rule_id: &str, duration_secs: f64) {
        self.eval_duration
            .with_label_values(&[rule_id])
            .observe(duration_secs);
    }

    /// Export metrics in Prometheus text format.
    pub fn gather_text_format(&self) -> anyhow::Result<String> {
        use prometheus::Encoder;
        let r = self.registry.read();
        let metrics = r.gather();
        let mut buffer = Vec::new();
        prometheus::TextEncoder::new().encode(&metrics, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
}

impl Default for MetricsRegistry {
    fn default() -> Self {
        Self::new().expect("metrics registry initialization failed")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_registry_creation() {
        let registry = MetricsRegistry::new().expect("registry creation failed");
        // Increment a counter so we have data
        registry.inc_connector_syncs("test", 1.0);
        let output = registry.gather_text_format().expect("should gather metrics");
        // Verify metrics were gathered
        assert!(!output.is_empty(), "metrics output should contain data after increment");
    }

    #[test]
    fn test_inc_connector_syncs() {
        let registry = MetricsRegistry::new().expect("registry creation failed");
        registry.inc_connector_syncs("github", 1.0);
        registry.inc_connector_syncs("github", 2.0);

        let output = registry.gather_text_format().unwrap();
        assert!(output.contains("connector_syncs_total"));
        assert!(output.contains("github"));
    }

    #[test]
    fn test_record_sync_duration() {
        let registry = MetricsRegistry::new().expect("registry creation failed");
        registry.record_sync_duration("github", 1.23);
        registry.record_sync_duration("github", 2.45);

        let output = registry.gather_text_format().unwrap();
        assert!(output.contains("connector_sync_duration_seconds"));
        assert!(output.contains("github"));
    }

    #[test]
    fn test_metrics_prometheus_text_format() {
        let registry = MetricsRegistry::new().expect("registry creation failed");
        registry.inc_rule_evaluations("rule-1", 1.0);
        registry.record_eval_duration("rule-1", 0.5);

        let output = registry.gather_text_format().unwrap();
        assert!(output.contains("# HELP"));
        assert!(output.contains("# TYPE"));
        assert!(output.contains("rule_evaluations_total"));
        assert!(output.contains("rule_eval_duration_seconds"));
    }

    #[test]
    fn test_global_singleton() {
        let m1 = MetricsRegistry::global();
        let m2 = MetricsRegistry::global();

        // Both should be the same instance
        assert_eq!(
            Arc::as_ptr(&m1) as *const _,
            Arc::as_ptr(&m2) as *const _
        );
    }

    #[test]
    fn test_inc_audit_appends() {
        let registry = MetricsRegistry::new().expect("registry creation failed");
        registry.inc_audit_appends("reward_grant", 3.0);
        registry.inc_audit_appends("penalty_apply", 1.0);

        let output = registry.gather_text_format().unwrap();
        assert!(output.contains("audit_appends_total"));
    }
}
