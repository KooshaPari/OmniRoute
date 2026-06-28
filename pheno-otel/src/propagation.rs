//! W3C Trace Context propagator (side-04).
//!
//! Implements [W3C Trace Context Level 2][w3c-tc] propagation: extract a
//! `SpanContext` from incoming HTTP-style headers and inject one back into
//! outgoing headers. This is the canonical cross-service trace propagation
//! surface for the pheno-* fleet; consumers depend on it for in-process
//! tracing consistency when a request crosses a service boundary (HTTP,
//! gRPC, message-queue, etc.).
//!
//! # Wire format
//!
//! The single carrier header is `traceparent`, value-shaped:
//!
//! ```text
//! version "-" trace-id "-" parent-id "-" trace-flags
//! 00       - 0af7651916cd43dd8448eb211c80319c - b7ad6b7169203331 - 01
//! ```
//!
//! Where:
//!
//! - `version`   — 2 lowercase hex chars; today only `00` is defined.
//! - `trace-id`  — 32 lowercase hex chars (128 bits). All-zero is invalid.
//! - `parent-id` — 16 lowercase hex chars (64 bits). All-zero is invalid.
//! - `trace-flags` — 2 lowercase hex chars (8 bits). Bit 0 = sampled.
//!
//! Total length is **55 chars** including the three `-` separators.
//!
//! # When to use
//!
//! - You need to extract/inject trace context across an HTTP/gRPC boundary.
//! - You want a fleet-wide consistent propagation surface that matches the
//!   W3C spec (so vendor SDKs, Jaeger, Tempo, Honeycomb, etc. interoperate).
//!
//! # When NOT to use
//!
//! - You only need in-process tracing → use `pheno-tracing` directly.
//! - You need a custom vendor header (B3, X-Amzn-Trace-Id, etc.) → fork
//!   this module or add a sibling `b3_propagator` and dispatch at the
//!   adapter boundary.
//!
//! [w3c-tc]: <https://www.w3.org/TR/trace-context/>

use std::collections::HashMap;

/// Canonical HTTP header name carrying the W3C trace context.
///
/// Lowercase per W3C spec §3.2 ("Header names are case-insensitive").
pub const TRACEPARENT_HEADER: &str = "traceparent";

/// A parsed W3C trace context (one half of a span identity).
///
/// `SpanContext` is the carrier-agnostic representation; the
/// [`W3CTraceContextPropagator`] converts between this struct and the
/// `traceparent` header wire format.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpanContext {
    /// W3C version field. Today only `0x00` is defined; future versions
    /// (0x01, 0xFE reserved, 0xFF invalid) are accepted but the parser
    /// returns the bytes verbatim so callers can route on version.
    pub version: u8,

    /// 128-bit trace identifier as 32 lowercase hex chars.
    pub trace_id: String,

    /// 64-bit parent span identifier as 16 lowercase hex chars.
    pub span_id: String,

    /// 8-bit trace-flags byte as 2 lowercase hex chars.
    pub trace_flags: u8,
}

impl SpanContext {
    /// True when the sampled bit (bit 0 of `trace_flags`) is set.
    pub fn is_sampled(&self) -> bool {
        self.trace_flags & 0x01 == 0x01
    }

    /// Construct a new SpanContext with default version 0x00 and no flags.
    pub fn new(trace_id: impl Into<String>, span_id: impl Into<String>) -> Self {
        Self {
            version: 0x00,
            trace_id: trace_id.into(),
            span_id: span_id.into(),
            trace_flags: 0x00,
        }
    }

    /// Construct a new sampled SpanContext.
    pub fn sampled(trace_id: impl Into<String>, span_id: impl Into<String>) -> Self {
        Self {
            version: 0x00,
            trace_id: trace_id.into(),
            span_id: span_id.into(),
            trace_flags: 0x01,
        }
    }
}

/// Errors returned by [`W3CTraceContextPropagator::extract`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PropagationError {
    /// The `traceparent` header was missing from the carrier.
    MissingHeader,
    /// The header was present but did not match the `version-trace-parent-flags`
    /// shape (wrong field count, wrong hex length, wrong characters).
    Malformed(&'static str),
    /// The `trace-id` was all zeros — reserved as invalid per W3C §3.2.2.3.
    InvalidTraceId,
    /// The `span-id` (parent-id) was all zeros — reserved as invalid per W3C §3.2.2.4.
    InvalidSpanId,
    /// The `version` byte was `0xFF` — explicitly invalid per W3C §3.2.2.1.
    InvalidVersion,
}

impl std::fmt::Display for PropagationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingHeader => f.write_str("missing traceparent header"),
            Self::Malformed(why) => write!(f, "malformed traceparent: {why}"),
            Self::InvalidTraceId => f.write_str("trace-id is all-zero (reserved)"),
            Self::InvalidSpanId => f.write_str("span-id is all-zero (reserved)"),
            Self::InvalidVersion => f.write_str("version 0xFF is reserved/invalid"),
        }
    }
}

impl std::error::Error for PropagationError {}

/// W3C Trace Context propagator.
///
/// Extract/inject across a `HashMap<String, String>` carrier (the in-memory
/// representation of HTTP headers). The carrier is case-insensitive on read;
/// injection always writes the lowercase canonical name `traceparent`.
#[derive(Debug, Default, Clone, Copy)]
pub struct W3CTraceContextPropagator;

impl W3CTraceContextPropagator {
    /// Construct a new propagator.
    pub fn new() -> Self {
        Self
    }

    /// Extract a [`SpanContext`] from the supplied headers.
    ///
    /// Header lookup is case-insensitive (HTTP semantics). Returns
    /// [`PropagationError::MissingHeader`] if `traceparent` is absent;
    /// [`PropagationError::Malformed`] if the value doesn't match the W3C
    /// shape; [`PropagationError::InvalidTraceId`] / `InvalidSpanId` if
    /// the all-zero rule is violated; [`PropagationError::InvalidVersion`]
    /// if version `0xFF` is encountered.
    pub fn extract(
        &self,
        headers: &HashMap<String, String>,
    ) -> Result<SpanContext, PropagationError> {
        // W3C: header names are case-insensitive. Find `traceparent` in any case.
        let value = headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(TRACEPARENT_HEADER))
            .map(|(_, v)| v.as_str())
            .ok_or(PropagationError::MissingHeader)?;

        self.parse_traceparent(value)
    }

    /// Inject a [`SpanContext`] into a fresh header map.
    ///
    /// The returned map contains a single entry, keyed by the lowercase
    /// canonical name `traceparent`, with the W3C wire-format value.
    pub fn inject(&self, ctx: &SpanContext) -> HashMap<String, String> {
        let mut out = HashMap::with_capacity(1);
        out.insert(
            TRACEPARENT_HEADER.to_string(),
            format!(
                "{:02x}-{:0>32}-{:0>16}-{:02x}",
                ctx.version, ctx.trace_id, ctx.span_id, ctx.trace_flags
            ),
        );
        out
    }

    /// Parse a raw `traceparent` string per the W3C Level 2 grammar.
    ///
    /// Public so callers that already have the header value (e.g. from a
    /// gRPC metadata slice) can reuse the parser without rebuilding a
    /// HashMap.
    pub fn parse_traceparent(
        &self,
        value: &str,
    ) -> Result<SpanContext, PropagationError> {
        // Trim leading/trailing whitespace (HTTP allows OWS around field values).
        let value = value.trim();

        // Split on '-' — exactly four fields required.
        let parts: Vec<&str> = value.split('-').collect();
        if parts.len() != 4 {
            return Err(PropagationError::Malformed("expected 4 dash-separated fields"));
        }

        let version_str = parts[0];
        let trace_id = parts[1];
        let span_id = parts[2];
        let flags_str = parts[3];

        // Version: exactly 2 hex chars.
        if version_str.len() != 2 {
            return Err(PropagationError::Malformed("version must be 2 hex chars"));
        }
        let version = u8::from_str_radix(version_str, 16)
            .map_err(|_| PropagationError::Malformed("version is not hex"))?;
        if version == 0xFF {
            return Err(PropagationError::InvalidVersion);
        }

        // Trace-id: exactly 32 hex chars, not all-zero.
        if trace_id.len() != 32 {
            return Err(PropagationError::Malformed("trace-id must be 32 hex chars"));
        }
        if !is_lower_hex(trace_id) {
            return Err(PropagationError::Malformed("trace-id is not lowercase hex"));
        }
        if trace_id.chars().all(|c| c == '0') {
            return Err(PropagationError::InvalidTraceId);
        }

        // Span-id (parent-id): exactly 16 hex chars, not all-zero.
        if span_id.len() != 16 {
            return Err(PropagationError::Malformed("span-id must be 16 hex chars"));
        }
        if !is_lower_hex(span_id) {
            return Err(PropagationError::Malformed("span-id is not lowercase hex"));
        }
        if span_id.chars().all(|c| c == '0') {
            return Err(PropagationError::InvalidSpanId);
        }

        // Flags: exactly 2 hex chars.
        if flags_str.len() != 2 {
            return Err(PropagationError::Malformed("trace-flags must be 2 hex chars"));
        }
        let trace_flags = u8::from_str_radix(flags_str, 16)
            .map_err(|_| PropagationError::Malformed("trace-flags is not hex"))?;

        Ok(SpanContext {
            version,
            trace_id: trace_id.to_string(),
            span_id: span_id.to_string(),
            trace_flags,
        })
    }
}

/// True when `s` is non-empty and every char is in `[0-9a-f]`.
fn is_lower_hex(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Canonical example from the W3C Trace Context Level 2 spec §3.2.1.
    const SAMPLE_TRACE_ID: &str = "0af7651916cd43dd8448eb211c80319c";
    const SAMPLE_SPAN_ID: &str = "b7ad6b7169203331";

    fn sample_header(sampled: bool) -> String {
        format!(
            "00-{}-{}-{:02x}",
            SAMPLE_TRACE_ID,
            SAMPLE_SPAN_ID,
            u8::from(sampled)
        )
    }

    #[test]
    fn extract_valid_sampled_parent() {
        // The W3C spec's reference example — round-trips through extract+inject.
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert("traceparent".to_string(), sample_header(true));

        let ctx = prop.extract(&headers).expect("extract should succeed");
        assert_eq!(ctx.version, 0x00);
        assert_eq!(ctx.trace_id, SAMPLE_TRACE_ID);
        assert_eq!(ctx.span_id, SAMPLE_SPAN_ID);
        assert_eq!(ctx.trace_flags, 0x01);
        assert!(ctx.is_sampled());
    }

    #[test]
    fn extract_unsampled_flag() {
        // trace-flags = 0x00 → not sampled; same parsing path.
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert("traceparent".to_string(), sample_header(false));

        let ctx = prop.extract(&headers).expect("extract should succeed");
        assert!(!ctx.is_sampled());
        assert_eq!(ctx.trace_flags, 0x00);
    }

    #[test]
    fn extract_rejects_invalid_version_0xff() {
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert(
            "traceparent".to_string(),
            format!("ff-{}-{}-01", SAMPLE_TRACE_ID, SAMPLE_SPAN_ID),
        );

        let err = prop.extract(&headers).unwrap_err();
        assert_eq!(err, PropagationError::InvalidVersion);
    }

    #[test]
    fn extract_rejects_all_zero_trace_id() {
        // trace-id = 0..0 (32 zeros) is reserved as invalid per W3C §3.2.2.3.
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert(
            "traceparent".to_string(),
            format!("00-00000000000000000000000000000000-{}-01", SAMPLE_SPAN_ID),
        );

        let err = prop.extract(&headers).unwrap_err();
        assert_eq!(err, PropagationError::InvalidTraceId);
    }

    #[test]
    fn extract_rejects_all_zero_span_id() {
        // parent-id = 0..0 (16 zeros) is reserved as invalid per W3C §3.2.2.4.
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert(
            "traceparent".to_string(),
            format!("00-{}-0000000000000000-01", SAMPLE_TRACE_ID),
        );

        let err = prop.extract(&headers).unwrap_err();
        assert_eq!(err, PropagationError::InvalidSpanId);
    }

    #[test]
    fn extract_rejects_missing_header() {
        let prop = W3CTraceContextPropagator::new();
        let headers: HashMap<String, String> = HashMap::new();
        let err = prop.extract(&headers).unwrap_err();
        assert_eq!(err, PropagationError::MissingHeader);
    }

    #[test]
    fn extract_rejects_wrong_field_count() {
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert("traceparent".to_string(), "00-only-three-fields".to_string());
        let err = prop.extract(&headers).unwrap_err();
        assert!(matches!(err, PropagationError::Malformed(_)));
    }

    #[test]
    fn extract_rejects_non_hex_trace_id() {
        // 32 chars but contains 'g' → not hex.
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert(
            "traceparent".to_string(),
            format!(
                "00-{}-{}",
                "g".repeat(32),
                SAMPLE_SPAN_ID
            ),
        );
        let err = prop.extract(&headers).unwrap_err();
        assert!(matches!(err, PropagationError::Malformed(_)));
    }

    #[test]
    fn extract_is_case_insensitive_on_header_name() {
        // HTTP semantics: header names are case-insensitive. `TraceParent`
        // must match the lowercase canonical.
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert("TraceParent".to_string(), sample_header(true));
        let ctx = prop.extract(&headers).expect("extract should succeed");
        assert_eq!(ctx.trace_id, SAMPLE_TRACE_ID);
    }

    #[test]
    fn extract_tolerates_future_versions() {
        // Per W3C §3.2.2.1, future versions (e.g. 01) MUST be parsed and
        // forwarded as-is. Verifying forward-compat here keeps the parser
        // from silently dropping a 0x01 version as malformed.
        let prop = W3CTraceContextPropagator::new();
        let mut headers = HashMap::new();
        headers.insert(
            "traceparent".to_string(),
            format!("01-{}-{}-01", SAMPLE_TRACE_ID, SAMPLE_SPAN_ID),
        );
        let ctx = prop.extract(&headers).expect("v01 should be tolerated");
        assert_eq!(ctx.version, 0x01);
    }

    #[test]
    fn inject_round_trips_through_extract() {
        // Symmetry check: inject(ctx) → extract(...) → ctx' should equal ctx.
        let prop = W3CTraceContextPropagator::new();
        let ctx = SpanContext::sampled(SAMPLE_TRACE_ID, SAMPLE_SPAN_ID);
        let headers = prop.inject(&ctx);
        let parsed = prop.extract(&headers).expect("round-trip parse");
        assert_eq!(ctx, parsed);
    }

    #[test]
    fn inject_writes_lowercase_canonical_header() {
        // The output map MUST key on the lowercase `traceparent` so callers
        // serializing to HTTP/1.1 wire format get the canonical name without
        // a separate normalization step.
        let prop = W3CTraceContextPropagator::new();
        let ctx = SpanContext::sampled(SAMPLE_TRACE_ID, SAMPLE_SPAN_ID);
        let headers = prop.inject(&ctx);
        assert!(headers.contains_key("traceparent"));
        // No uppercase variant present.
        assert!(!headers.contains_key("TraceParent"));
        let value = headers.get("traceparent").unwrap();
        assert_eq!(value.len(), 55); // 2 + 1 + 32 + 1 + 16 + 1 + 2
        assert!(value.starts_with("00-"));
    }

    #[test]
    fn span_context_is_sampled_bit_only() {
        // is_sampled() looks at bit 0 only — flags like 0x03 (sampled +
        // future flag) must still register as sampled.
        let ctx = SpanContext {
            version: 0x00,
            trace_id: SAMPLE_TRACE_ID.to_string(),
            span_id: SAMPLE_SPAN_ID.to_string(),
            trace_flags: 0x03,
        };
        assert!(ctx.is_sampled());

        let ctx = SpanContext {
            version: 0x00,
            trace_id: SAMPLE_TRACE_ID.to_string(),
            span_id: SAMPLE_SPAN_ID.to_string(),
            trace_flags: 0xFE, // bit 0 clear
        };
        assert!(!ctx.is_sampled());
    }
}
