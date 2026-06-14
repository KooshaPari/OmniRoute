//! Error types for `pheno-otel`.
//!
//! All fallible operations in this crate return [`Result<T, OtelError>`]. The
//! three-variant enum maps 1:1 to the three failure modes a caller may see
//! during the lifecycle of an OpenTelemetry pipeline:
//!
//! | Variant | When it fires |
//! |---|---|
//! | [`OtelError::ExporterInit`] | The OTLP [`SpanExporter`] builder rejected the configuration (e.g. an invalid endpoint URI). Returned by [`crate::init`]. |
//! | [`OtelError::ResourceBuild`] | The [`Resource`] (the entity that produces telemetry) could not be assembled — for example, because the caller passed an empty `service_name`. Returned by [`crate::init`] and [`crate::init_with_stdout`]. |
//! | [`OtelError::Shutdown`] | The tracer provider could not be shut down cleanly — either `force_flush()` or `shutdown()` returned an error. Returned by [`TelemetryGuard::shutdown`](crate::guard::TelemetryGuard::shutdown). |
//!
//! [`SpanExporter`]: opentelemetry_sdk::export::trace::SpanExporter
//! [`Resource`]: opentelemetry_sdk::Resource

use thiserror::Error;

/// The canonical error type for the `pheno-otel` crate.
#[derive(Debug, Error)]
pub enum OtelError {
    /// The OTLP span exporter could not be initialized.
    ///
    /// Typical causes: invalid endpoint URI, missing `http-proto` / `grpc-tonic`
    /// feature, or the underlying HTTP client could not be constructed.
    #[error("opentelemetry exporter init failed: {0}")]
    ExporterInit(String),

    /// The telemetry resource (the entity that produces telemetry) could not
    /// be built.
    ///
    /// Typical causes: the caller passed an empty or otherwise invalid
    /// `service_name`. The resource carries the `service.name` attribute that
    /// every span is attributed to, so it must be non-empty.
    #[error("opentelemetry resource build failed: {0}")]
    ResourceBuild(String),

    /// The tracer provider could not be shut down cleanly.
    ///
    /// Returned by [`crate::guard::TelemetryGuard::shutdown`] when
    /// `force_flush()` or `shutdown()` reports a transport error. The Drop
    /// impl on the guard also logs these at WARN level; the variant exists
    /// so an explicit shutdown can surface the error to the caller.
    #[error("opentelemetry tracer provider shutdown failed: {0}")]
    Shutdown(String),
}

impl OtelError {
    /// Stable, lowercase, snake_case kind tag — suitable for log fields and
    /// metrics labels. Do NOT use as a wire error code.
    pub const fn kind(&self) -> &'static str {
        match self {
            Self::ExporterInit(_) => "exporter_init",
            Self::ResourceBuild(_) => "resource_build",
            Self::Shutdown(_) => "shutdown",
        }
    }

    /// Convenience constructor for [`OtelError::ExporterInit`].
    pub fn exporter_init(msg: impl Into<String>) -> Self {
        Self::ExporterInit(msg.into())
    }

    /// Convenience constructor for [`OtelError::ResourceBuild`].
    pub fn resource_build(msg: impl Into<String>) -> Self {
        Self::ResourceBuild(msg.into())
    }

    /// Convenience constructor for [`OtelError::Shutdown`].
    pub fn shutdown(msg: impl Into<String>) -> Self {
        Self::Shutdown(msg.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kind_is_stable() {
        assert_eq!(OtelError::exporter_init("x").kind(), "exporter_init");
        assert_eq!(OtelError::resource_build("x").kind(), "resource_build");
        assert_eq!(OtelError::shutdown("x").kind(), "shutdown");
    }

    #[test]
    fn constructors_set_variant() {
        assert!(matches!(
            OtelError::exporter_init("e"),
            OtelError::ExporterInit(_)
        ));
        assert!(matches!(
            OtelError::resource_build("r"),
            OtelError::ResourceBuild(_)
        ));
        assert!(matches!(OtelError::shutdown("s"), OtelError::Shutdown(_)));
    }

    #[test]
    fn display_mentions_kind() {
        // Display must mention the kind word so logs are searchable.
        let e = OtelError::exporter_init("bad uri");
        assert!(e.to_string().contains("exporter"));
        let e = OtelError::resource_build("empty");
        assert!(e.to_string().contains("resource"));
        let e = OtelError::shutdown("timeout");
        assert!(e.to_string().contains("shutdown"));
    }

    #[test]
    fn is_std_error() {
        use std::error::Error;
        fn assert_is_error<E: std::error::Error>(_: &E) {}
        let e = OtelError::shutdown("x");
        assert_is_error(&e);
        // No source by default; the inner trace error is rendered into the
        // display string at construction time so the variant stays a
        // self-contained thiserror enum.
        assert!(e.source().is_none(), "no source by default");
    }
}
