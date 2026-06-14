//! The [`TelemetryGuard`] RAII type returned by `init` / `init_with_stdout`.
//!
//! Dropping the guard is the canonical way to flush and shut down the
//! global tracer provider. The implementation calls
//! [`opentelemetry::global::shutdown_tracer_provider`] to replace the
//! global with a no-op provider, then runs an explicit `force_flush` +
//! `shutdown` on the held `TracerProvider` clone so that any in-flight
//! spans get exported.
//!
//! Errors from the Drop path are logged at WARN with the crate's standard
//! `error.kind` field (see [`crate::error::OtelError::kind`]) and
//! otherwise swallowed — Drop cannot return. Callers that need a typed
//! error from shutdown can call [`TelemetryGuard::shutdown`] explicitly
//! and store the guard in a `let _guard = …;` binding; the explicit
//! shutdown does NOT prevent the Drop impl from running (the operations
//! are idempotent), but it does surface the error to the caller.

use std::fmt;

use opentelemetry::global;
use opentelemetry_sdk::trace::TracerProvider;

use crate::error::OtelError;

/// RAII guard that flushes + shuts down the OpenTelemetry tracer provider
/// on drop.
///
/// Construct one via [`crate::init`] or [`crate::init_with_stdout`]. Drop
/// is fire-and-forget; for typed error handling call
/// [`TelemetryGuard::shutdown`] explicitly.
pub struct TelemetryGuard {
    /// Held so the provider stays alive (and reachable for `force_flush`)
    /// until the guard is dropped.
    provider: TracerProvider,
    /// Human-readable label of the source (OTLP or stdout). Used only in
    /// the `Debug` impl so test failures are easy to attribute.
    source: &'static str,
}

impl TelemetryGuard {
    /// Construct a new guard that owns `provider`.
    pub(crate) fn new(provider: TracerProvider, source: &'static str) -> Self {
        Self { provider, source }
    }

    /// Explicitly flush pending spans and shut down the held provider.
    pub fn shutdown(&self) -> Result<(), OtelError> {
        let flush_errors = self.provider.force_flush();
        for result in &flush_errors {
            if let Err(e) = result {
                return Err(OtelError::shutdown(format!(
                    "force_flush returned error: {e}"
                )));
            }
        }
        if let Err(e) = self.provider.shutdown() {
            return Err(OtelError::shutdown(format!(
                "tracer provider shutdown returned error: {e}"
            )));
        }
        Ok(())
    }
}

impl fmt::Debug for TelemetryGuard {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TelemetryGuard")
            .field("source", &self.source)
            .finish_non_exhaustive()
    }
}

impl Drop for TelemetryGuard {
    fn drop(&mut self) {
        // Replace the global with a no-op provider first; subsequent
        // `global::tracer(...)` calls will get a noop tracer.
        global::shutdown_tracer_provider();

        // Try to flush all in-flight spans and shut down the held
        // provider. Drop can't return errors, so we log to stderr and
        // move on.
        if let Err(e) = self.shutdown() {
            eprintln!(
                "pheno_otel::TelemetryGuard: shutdown reported error (kind={}): {e}",
                e.kind()
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use opentelemetry::trace::{Span, Tracer, TracerProvider as _};

    #[test]
    fn default_provider_shutdown_is_ok() {
        let provider = TracerProvider::builder().build();
        let guard = TelemetryGuard::new(provider, "test-default");
        guard.shutdown().expect("first shutdown should succeed");
    }

    #[test]
    fn drop_does_not_panic() {
        let provider = TracerProvider::builder().build();
        let guard = TelemetryGuard::new(provider, "test-drop");
        drop(guard);
    }

    #[test]
    fn drop_with_active_span_does_not_panic() {
        let provider = TracerProvider::builder().build();
        let tracer = provider.tracer("test");
        let mut span = tracer.start("test-span");
        span.end();
        let guard = TelemetryGuard::new(provider, "test-span");
        drop(guard);
    }
}
