//! OpenTelemetry integration for the OmniRoute Rust data plane.
//!
//! Feature-gated behind `--features otel`. When enabled, initializes a
//! batch OTLP span exporter, constructs an SDK `TracerProvider`, and
//! registers a `tracing-opentelemetry` layer that bridges `tracing`
//! spans to OTel spans.
//!
//! # Feature gate
//!
//! `otel` feature is disabled by default to keep the crate lightweight
//! (protobuf/tonic/gRPC add ~50 deps). Enable via:
//!
//! ```toml,ignore
//! omniroute-runtime = { path = ".", features = ["otel"] }
//! ```

use opentelemetry::trace::TracerProvider as _;
use opentelemetry_sdk::trace::TracerProvider;
use tracing_subscriber::prelude::*;

/// Guard that flushes and shuts down the OTel pipeline on drop.
pub struct TelemetryGuard {
    _provider: TracerProvider,
}

impl TelemetryGuard {
    /// Extend the subscriber registry with the OpenTelemetry tracing layer.
    pub fn init(self) {
        let tracer = self._provider.tracer("omniroute-runtime");
        let otel_layer = tracing_opentelemetry::OpenTelemetryLayer::new(tracer);
        tracing_subscriber::registry().with(otel_layer).init();
    }
}

impl Drop for TelemetryGuard {
    fn drop(&mut self) {
        if let Err(e) = self._provider.shutdown() {
            tracing::warn!("otel tracer provider shutdown: {e}");
        }
    }
}

/// Initialise OpenTelemetry from environment variables.
///
/// Reads `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4317`) and
/// standard OTel env vars. The `OTEL_SDK_DISABLED` env var can be set to
/// `"true"` to skip initialisation entirely (no-op).
pub fn init_from_env() -> Option<TelemetryGuard> {
    if std::env::var("OTEL_SDK_DISABLED").as_deref() == Ok("true") {
        return None;
    }

    let exporter = match opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .build()
    {
        Ok(e) => e,
        Err(e) => {
            tracing::warn!("failed to build OTLP span exporter: {e}; telemetry disabled");
            return None;
        }
    };

    let provider = TracerProvider::builder()
        .with_batch_exporter(exporter, opentelemetry_sdk::runtime::Tokio)
        .build();

    Some(TelemetryGuard { _provider: provider })
}
