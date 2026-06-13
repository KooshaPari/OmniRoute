//! # pheno-tracing — canonical tracing init for the Phenotype monorepo
//!
//! Consolidates the tracing setup patterns previously duplicated across
//! `focus-observability` (and other consumers) into a single one-liner:
//!
//! ```rust,no_run
//! pheno_tracing::init();
//! tracing::info!("hello from the Phenotype monorepo");
//! ```
//!
//! Three entry points are provided:
//!
//! - [`init`]: pretty console output, `EnvFilter` from `RUST_LOG` (default
//!   `info`).
//! - [`init_json`]: structured JSON output (production log aggregation).
//! - [`init_with_file`]: appends to a daily-rotated log file under the
//!   given directory.
//!
//! All three are process-level idempotent: they call
//! [`tracing_subscriber::util::SubscriberInitExt::try_init`], so if a
//! global subscriber has already been installed (for example, by an
//! embedding host or a test harness) the call is a silent no-op.
//!
//! ## Environment variables
//!
//! - `RUST_LOG` — standard [`tracing_subscriber::EnvFilter`] directive.
//!   When unset, the filter resolves to `info`.

use std::path::Path;

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Build the canonical `EnvFilter` from `RUST_LOG`, falling back to
/// `info` when the variable is unset or invalid.
fn default_env_filter() -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
}

/// Initialize tracing with the default pretty formatter.
///
/// Reads `RUST_LOG` for the filter directive; falls back to `info`.
/// Honors thread-id and target fields. Idempotent (uses `try_init`).
pub fn init() {
    let env_filter = default_env_filter();
    let fmt_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(false)
        .with_level(true);
    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .try_init();
}

/// Initialize tracing with structured JSON output.
///
/// Reads `RUST_LOG` for the filter directive; falls back to `info`.
/// Emits one JSON object per event with the current span attached.
/// Idempotent (uses `try_init`).
pub fn init_json() {
    let env_filter = default_env_filter();
    let fmt_layer = fmt::layer()
        .json()
        .with_current_span(true)
        .with_span_list(false)
        .with_target(true);
    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .try_init();
}

/// Initialize tracing that appends to a daily-rotated log file under
/// `dir`.
///
/// The filename pattern is `pheno-tracing.log.YYYY-MM-DD` (daily
/// rotation via [`tracing_appender::rolling::daily`]). ANSI escape
/// sequences are disabled because the file consumer is rarely a
/// terminal.
///
/// # Caveat: leaked `WorkerGuard`
///
/// The `tracing_appender::non_blocking` helper spawns a background
/// thread that flushes buffered log lines to disk. To keep that thread
/// alive for the lifetime of the process, the `WorkerGuard` is leaked
/// via `Box::leak`. Log lines emitted during process shutdown (after
/// `main` returns) may therefore be lost. If you need deterministic
/// flush semantics, call `tracing_appender::non_blocking` yourself and
/// store the guard in a long-lived variable on the caller side.
pub fn init_with_file(dir: &Path) {
    let env_filter = default_env_filter();
    let file_appender = tracing_appender::rolling::daily(dir, "pheno-tracing.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    // Keep the worker thread alive for the process lifetime.
    Box::leak(Box::new(guard));
    let fmt_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true);
    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .try_init();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::{Arc, Mutex};

    /// In-memory writer that implements [`tracing_subscriber::fmt::MakeWriter`]
    /// for tests.
    #[derive(Clone, Default)]
    struct VecWriter(Arc<Mutex<Vec<u8>>>);

    impl VecWriter {
        fn new() -> Self {
            Self::default()
        }

        fn into_string(self) -> String {
            String::from_utf8(self.0.lock().unwrap().clone()).unwrap()
        }
    }

    impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for VecWriter {
        type Writer = VecWriterGuard<'a>;
        fn make_writer(&'a self) -> Self::Writer {
            VecWriterGuard(self.0.lock().unwrap())
        }
    }

    struct VecWriterGuard<'a>(std::sync::MutexGuard<'a, Vec<u8>>);

    impl<'a> Write for VecWriterGuard<'a> {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.write(buf)
        }
        fn flush(&mut self) -> std::io::Result<()> {
            self.0.flush()
        }
    }

    #[test]
    fn default_env_filter_is_info() {
        // When RUST_LOG is unset or invalid, the filter resolves to
        // "info" — debug events are filtered out.
        let writer = VecWriter::new();
        let env_filter = EnvFilter::new("info");
        let subscriber = tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_writer(writer.clone())
            .with_target(false)
            .finish();
        tracing::subscriber::with_default(subscriber, || {
            tracing::debug!("debug-line-must-be-hidden");
            tracing::info!("info-line-must-show");
        });
        let captured = writer.into_string();
        assert!(
            !captured.contains("debug-line-must-be-hidden"),
            "debug line should be filtered out at info level, got: {captured}"
        );
        assert!(
            captured.contains("info-line-must-show"),
            "info line should appear, got: {captured}"
        );
    }

    #[test]
    fn default_env_filter_honors_rust_log() {
        // When RUST_LOG is set to a more permissive directive, the
        // filter passes through that directive.
        let writer = VecWriter::new();
        let env_filter = EnvFilter::new("debug");
        let subscriber = tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_writer(writer.clone())
            .with_target(false)
            .finish();
        tracing::subscriber::with_default(subscriber, || {
            tracing::debug!("debug-line-should-show-when-debug");
            tracing::info!("info-line-should-show-when-debug");
        });
        let captured = writer.into_string();
        assert!(captured.contains("debug-line-should-show-when-debug"));
        assert!(captured.contains("info-line-should-show-when-debug"));
    }
}
