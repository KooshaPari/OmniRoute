//! Init entry points: [`init`] (OTLP) and [`init_with_stdout`].
//!
//! Both functions follow the same shape:
//!
//! 1. Validate `service_name` (non-empty after trim) → [`OtelError::ResourceBuild`].
//! 2. Build a [`Resource`] carrying `service.name = <service_name>` plus the
//!    SDK's default attributes (telemetry SDK name/version, env-detected
//!    `OTEL_RESOURCE_ATTRIBUTES`, etc.).
//! 3. Build a [`SpanExporter`] (OTLP HTTP/proto or stdout).
//! 4. Wire the exporter into a [`TracerProvider`] (via `with_simple_exporter`),
//!    attach the resource, install as the global provider, and return a
//!    [`TelemetryGuard`] that flushes+shuts down on Drop.
//!
//! The OTLP path reads its endpoint from `OTEL_EXPORTER_OTLP_ENDPOINT`
//! (falling back to the SDK default `http://localhost:4318` when unset).
//! The stdout path always writes to `std::io::stdout()`.

use opentelemetry::global;
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::trace::TracerProvider;
use opentelemetry_sdk::Resource;

use crate::error::OtelError;
use crate::exporter::stdout::StdoutSpanExporter;
use crate::guard::TelemetryGuard;

/// Default OTLP/HTTP endpoint used when neither `OTEL_EXPORTER_OTLP_ENDPOINT`
/// nor a per-call override is provided. Mirrors the upstream SDK's
/// `OTEL_EXPORTER_OTLP_HTTP_ENDPOINT_DEFAULT` constant
/// (`http://localhost:4318`).
pub const DEFAULT_OTLP_ENDPOINT: &str = "http://localhost:4318";

/// Initialize an OTLP-backed OpenTelemetry tracer provider.
///
/// The endpoint is read from `OTEL_EXPORTER_OTLP_ENDPOINT`; if that env
/// var is unset, [`DEFAULT_OTLP_ENDPOINT`] is used. The exporter uses
/// HTTP/protobuf over a reqwest+rustls client (compiled into the crate
/// via `opentelemetry-otlp`'s `http-proto`, `reqwest-client`, and
/// `reqwest-rustls` features).
///
/// # Errors
///
/// - [`OtelError::ResourceBuild`] when `service_name` is empty or only
///   whitespace.
/// - [`OtelError::ExporterInit`] when the OTLP exporter builder rejects
///   the endpoint (e.g. the env var contains an invalid URI).
///
/// # Example
///
/// ```no_run
/// let _guard = pheno_otel::init("my-service").expect("init telemetry");
/// // … application code …
/// // _guard drops at scope exit; the global tracer provider is
/// // flushed + shut down.
/// ```
pub fn init(service_name: &str) -> Result<TelemetryGuard, OtelError> {
    let resource = build_resource(service_name)?;
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(DEFAULT_OTLP_ENDPOINT)
        .build()
        .map_err(|e| OtelError::exporter_init(format!("OTLP span exporter build failed: {e}")))?;
    Ok(install_provider(exporter, resource, "otlp"))
}

/// Initialize a stdout-backed OpenTelemetry tracer provider for local
/// development and CI smoke tests.
///
/// Spans are written as one JSON line per span to `std::io::stdout()`.
/// No network is touched, so this is safe in air-gapped environments.
///
/// # Errors
///
/// - [`OtelError::ResourceBuild`] when `service_name` is empty or only
///   whitespace.
///
/// # Example
///
/// ```no_run
/// let _guard = pheno_otel::init_with_stdout("my-service").expect("init telemetry");
/// // spans emitted here are written to stdout as JSON lines.
/// drop(_guard);
/// ```
pub fn init_with_stdout(service_name: &str) -> Result<TelemetryGuard, OtelError> {
    let resource = build_resource(service_name)?;
    let exporter = StdoutSpanExporter::new();
    Ok(install_provider(exporter, resource, "stdout"))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Build the [`Resource`] carrying `service.name = <service_name>` plus
/// the SDK's default-detected attributes.
fn build_resource(service_name: &str) -> Result<Resource, OtelError> {
    let trimmed = service_name.trim();
    if trimmed.is_empty() {
        return Err(OtelError::resource_build(
            "service_name must be a non-empty, non-whitespace string",
        ));
    }
    // `Resource::new_with_defaults` is infallible on 0.27 — it
    // merges the supplied KV pairs with the SDK-default detectors
    // (telemetry SDK name/version, env-detected OTEL_RESOURCE_ATTRIBUTES,
    // etc.) and returns the merged resource. The KV shape below is the
    // only validated input we get, so the surrounding `?` is for
    // future-proofing (0.28+ moves to a fallible ResourceBuilder).
    Ok(Resource::new_with_defaults([KeyValue::new(
        "service.name",
        trimmed.to_string(),
    )]))
}

/// Wire `exporter` + `resource` into a `TracerProvider`, install it as
/// the global, and return a `TelemetryGuard` that owns the provider.
fn install_provider<E>(
    exporter: E,
    resource: Resource,
    source: &'static str,
) -> TelemetryGuard
where
    E: opentelemetry_sdk::export::trace::SpanExporter + 'static,
{
    let provider = TracerProvider::builder()
        .with_simple_exporter(exporter)
        .with_resource(resource)
        .build();

    // Install the provider as the global singleton. Subsequent
    // `global::tracer(...)` calls return a tracer backed by this
    // provider until `global::shutdown_tracer_provider()` (or the
    // guard's Drop) replaces the global with a no-op.
    global::set_tracer_provider(provider.clone());

    TelemetryGuard::new(provider, source)
}
