//! Stdout [`SpanExporter`] implementation used by [`crate::init_with_stdout`].
//!
//! We avoid pulling in a separate `opentelemetry-stdout` crate and instead
//! implement the [`SpanExporter`] trait directly. The exporter serializes
//! each [`SpanData`] into a single JSON line on stdout; the format is
//! intentionally minimal (no protobuf) so it is human-greppable during
//! local development.
//!
//! The exporter is a zero-dependency addition on top of the OpenTelemetry
//! SDK we already pull in for the OTLP path.

use std::fmt;
use std::io::Write;

use futures_util::future::BoxFuture;
use futures_util::FutureExt;
use opentelemetry::trace::{SpanId, TraceError};
use opentelemetry_sdk::export::trace::{ExportResult, SpanData, SpanExporter};

/// Span exporter that writes one JSON line per span to stdout.
///
/// Useful for local development and CI smoke tests; production should use
/// the OTLP exporter via [`crate::init`].
#[derive(Debug, Default)]
pub struct StdoutSpanExporter {
    /// Monotonically increasing span counter; used in the JSON payload as
    /// a fallback when the span name is empty. Mirrors what the
    /// official `opentelemetry-stdout` crate does.
    seq: std::sync::atomic::AtomicU64,
}

impl StdoutSpanExporter {
    /// Construct a new `StdoutSpanExporter`.
    pub fn new() -> Self {
        Self::default()
    }

    /// Render a single span as a one-line JSON object.
    ///
    /// Returns `None` for any field that is not representable as a
    /// primitive (we never fail export over formatting — we just skip
    /// the field).
    fn render(span: &SpanData, seq: u64) -> String {
        let name = if span.name.is_empty() {
            format!("span#{seq}")
        } else {
            span.name.to_string()
        };
        let trace_id = span.span_context.trace_id().to_string();
        let span_id = span.span_context.span_id().to_string();
        let parent_span_id = if span.parent_span_id == SpanId::INVALID {
            String::new()
        } else {
            span.parent_span_id.to_string()
        };
        let status = format!("{:?}", span.status);
        let kind = format!("{:?}", span.span_kind);
        // Build a tiny JSON object by hand. We avoid pulling in
        // serde_json for this minimal exporter — the field set is
        // stable and we do not need escape robustness beyond the
        // basics.
        let mut out = String::with_capacity(256);
        out.push('{');
        push_kv(&mut out, "name", &name, false);
        push_kv(&mut out, "trace_id", &trace_id, true);
        push_kv(&mut out, "span_id", &span_id, true);
        push_kv(&mut out, "parent_span_id", &parent_span_id, true);
        push_kv(&mut out, "kind", &kind, true);
        push_kv(&mut out, "status", &status, true);
        push_kv(&mut out, "scope", span.instrumentation_scope.name(), true);
        out.push('}');
        out
    }
}

impl SpanExporter for StdoutSpanExporter {
    fn export(&mut self, batch: Vec<SpanData>) -> BoxFuture<'static, ExportResult> {
        // We render and write synchronously, then return an immediately-
        // resolved future. This matches the "simple" exporter
        // semantics — the SDK expects `export` to actually ship data
        // before returning when using `SimpleSpanProcessor`, which is
        // what `init_with_stdout` wires up.
        let mut stdout = std::io::stdout().lock();
        for span in &batch {
            let seq = self.seq.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let line = Self::render(span, seq);
            if let Err(e) = writeln!(stdout, "{line}") {
                return async move { Err(trace_err_from_io(e)) }.boxed();
            }
        }
        if let Err(e) = stdout.flush() {
            return async move { Err(trace_err_from_io(e)) }.boxed();
        }
        async { Ok(()) }.boxed()
    }

    fn shutdown(&mut self) {
        // Best-effort flush of stdout. Errors are non-fatal — the
        // shutdown is a no-op even on failure.
        let _ = std::io::stdout().flush();
    }

    fn force_flush(&mut self) -> BoxFuture<'static, ExportResult> {
        let result = std::io::stdout().flush().map_err(trace_err_from_io);
        async move { result }.boxed()
    }
}

impl fmt::Display for StdoutSpanExporter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("StdoutSpanExporter")
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Append `"key": "value"` to `out`, with a leading comma if `leading_comma`.
fn push_kv(out: &mut String, key: &str, value: &str, leading_comma: bool) {
    if leading_comma {
        out.push(',');
    }
    out.push('"');
    out.push_str(key);
    out.push_str("\":\"");
    push_json_escaped(out, value);
    out.push('"');
}

/// Minimal JSON string escaper — covers `"`, `\`, and control chars.
fn push_json_escaped(out: &mut String, s: &str) {
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                use std::fmt::Write as _;
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
}

/// Convert a `std::io::Error` into the `TraceError` enum's `Other` arm.
fn trace_err_from_io(err: std::io::Error) -> TraceError {
    TraceError::Other(Box::new(err))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_uses_name_when_present() {
        let span = SpanData {
            name: "my-span".into(),
            ..sample_span()
        };
        let line = StdoutSpanExporter::render(&span, 0);
        assert!(line.contains("\"name\":\"my-span\""), "got: {line}");
    }

    #[test]
    fn render_falls_back_to_seq_when_name_empty() {
        let span = SpanData {
            name: "".into(),
            ..sample_span()
        };
        let line = StdoutSpanExporter::render(&span, 42);
        assert!(line.contains("\"name\":\"span#42\""), "got: {line}");
    }

    #[test]
    fn render_skips_invalid_parent_span_id() {
        let span = sample_span();
        let line = StdoutSpanExporter::render(&span, 0);
        // INVALID parent is serialized as empty string, not the raw zero.
        assert!(line.contains("\"parent_span_id\":\"\""), "got: {line}");
    }

    fn sample_span() -> SpanData {
        use opentelemetry::trace::{SpanContext, SpanKind, Status, TraceFlags, TraceId, TraceState};
        use opentelemetry::InstrumentationScope;
        SpanData {
            span_context: SpanContext::new(
                TraceId::from_bytes([0x01; 16]),
                SpanId::from_bytes([0x02; 8]),
                TraceFlags::default(),
                true,
                TraceState::default(),
            ),
            parent_span_id: SpanId::INVALID,
            span_kind: SpanKind::Internal,
            name: "default".into(),
            start_time: std::time::SystemTime::UNIX_EPOCH,
            end_time: std::time::SystemTime::UNIX_EPOCH,
            attributes: Vec::new(),
            dropped_attributes_count: 0,
            events: Default::default(),
            links: Default::default(),
            status: Status::Unset,
            instrumentation_scope: InstrumentationScope::builder("test-scope").build(),
        }
    }
}
