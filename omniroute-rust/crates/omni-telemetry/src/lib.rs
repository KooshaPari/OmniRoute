//! omni-telemetry: structured logging, metrics, audit log, span context.
//!
//! Three responsibilities:
//!  1. Initialize the global `tracing` subscriber with the right format
//!     and env filter.
//!  2. Provide a thread-safe metrics registry (counters, gauges, histograms).
//!  3. Append-only audit log for compliance-grade traceability.
//!
//! All public APIs are `Send + Sync` and panic-free.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod audit;
pub mod metrics;
pub mod span;

pub use audit::{AuditEvent, AuditKind, AuditLog, AuditOutcome};
pub use metrics::{Counter, Gauge, Histogram, Metrics, MetricsSnapshot};
pub use span::{SpanContext, TraceFlags, TraceState};

use std::sync::OnceLock;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static INIT: OnceLock<()> = OnceLock::new();

/// Initialize the global tracing subscriber. Idempotent; safe to call from
/// multiple threads; only the first call wins. Format and level are driven
/// by env vars (`OMNI_TELEMETRY_FORMAT=json|text`, `RUST_LOG=info`).
pub fn init() {
    INIT.get_or_init(setup);
}

fn setup() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let format = std::env::var("OMNI_TELEMETRY_FORMAT")
        .map(|v| v.eq_ignore_ascii_case("json"))
        .unwrap_or(false);

    if format {
        let json_layer = fmt::layer()
            .json()
            .with_current_span(true)
            .with_span_list(false)
            .with_target(true);
        let _ = tracing_subscriber::registry()
            .with(filter)
            .with(json_layer)
            .try_init();
    } else {
        let fmt_layer = fmt::layer()
            .with_target(true)
            .with_thread_ids(false)
            .with_line_number(false);
        let _ = tracing_subscriber::registry()
            .with(filter)
            .with(fmt_layer)
            .try_init();
    }
}

/// Reset the subscriber state. Test-only. Production code never calls this.
pub fn reset_for_tests() {
    // tracing::subscriber::set_global_default cannot be unset; we just rely
    // on tests using `tracing-test` or building their own subscriber.
}
