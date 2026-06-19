use std::collections::HashMap;
use std::fmt;

use http::HeaderMap;

/// Error type for [`Context`] construction.
#[derive(Debug, thiserror::Error)]
pub enum ContextError {
    /// A required field or header was missing.
    #[error("missing header: {0}")]
    MissingHeader(String),
}

/// Canonical request context carrying identifiers, user/org metadata,
/// and an extensible key-value bag.
#[derive(Clone, Debug, PartialEq)]
#[must_use = "Context is a value type; an unused Context is almost always a logic bug"]
pub struct Context {
    pub request_id: String,
    pub span_id: String,
    pub trace_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Builder for [`Context`].
#[derive(Clone, Debug, Default)]
#[must_use = "ContextBuilder is a builder; an unused value is almost always a logic bug"]
pub struct ContextBuilder {
    request_id: Option<String>,
    span_id: Option<String>,
    trace_id: Option<String>,
    user_id: Option<String>,
    org_id: Option<String>,
    metadata: HashMap<String, String>,
}

impl Context {
    /// Start building a new [`Context`].
    ///
    /// ```
    /// use pheno_context::Context;
    ///
    /// let ctx = Context::new()
    ///     .with_request_id("req-1")
    ///     .with_span_id("span-1")
    ///     .with_trace_id("trace-1")
    ///     .build()
    ///     .expect("required fields set");
    /// assert_eq!(ctx.request_id, "req-1");
    /// ```
    #[allow(clippy::new_ret_no_self)]
    #[must_use = "returns a builder; an unused builder is almost always a logic bug"]
    pub fn new() -> ContextBuilder {
        ContextBuilder::default()
    }

    /// Extract a [`Context`] from known HTTP headers.
    ///
    /// Required headers:
    /// - `X-Request-ID`
    /// - `X-Trace-ID`
    /// - `X-Span-ID`
    ///
    /// Optional headers:
    /// - `X-User-ID`
    /// - `X-Org-ID`
    ///
    /// ```
    /// use http::HeaderMap;
    /// use pheno_context::Context;
    ///
    /// let mut headers = HeaderMap::new();
    /// headers.insert("X-Request-ID", "req-1".parse().unwrap());
    /// headers.insert("X-Trace-ID",  "trace-1".parse().unwrap());
    /// headers.insert("X-Span-ID",   "span-1".parse().unwrap());
    ///
    /// let ctx = Context::from_headers(&headers).expect("required headers present");
    /// assert_eq!(ctx.request_id, "req-1");
    /// assert_eq!(ctx.trace_id, "trace-1");
    /// ```
    #[must_use = "Result-returning; ignoring the Err arm silently masks a missing header"]
    pub fn from_headers(headers: &HeaderMap) -> Result<Self, ContextError> {
        let request_id = extract_header(headers, "X-Request-ID")?;
        let trace_id = extract_header(headers, "X-Trace-ID")?;
        let span_id = extract_header(headers, "X-Span-ID")?;
        let user_id = extract_header_optional(headers, "X-User-ID");
        let org_id = extract_header_optional(headers, "X-Org-ID");

        Ok(Self {
            request_id,
            span_id,
            trace_id,
            user_id,
            org_id,
            metadata: HashMap::new(),
        })
    }
}

impl fmt::Display for Context {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "request_id={request_id}, span_id={span_id}, trace_id={trace_id}, user_id={user_id}, org_id={org_id}, metadata={metadata:?}",
            request_id = self.request_id,
            span_id = self.span_id,
            trace_id = self.trace_id,
            user_id = self.user_id.as_deref().unwrap_or("None"),
            org_id = self.org_id.as_deref().unwrap_or("None"),
            metadata = self.metadata,
        )
    }
}

impl ContextBuilder {
    /// Set the request identifier.
    #[must_use = "builder method returns `self`; a discarded result is almost always a bug"]
    pub fn with_request_id(mut self, request_id: impl Into<String>) -> Self {
        self.request_id = Some(request_id.into());
        self
    }

    /// Set the span identifier.
    #[must_use = "builder method returns `self`; a discarded result is almost always a bug"]
    pub fn with_span_id(mut self, span_id: impl Into<String>) -> Self {
        self.span_id = Some(span_id.into());
        self
    }

    /// Set the trace identifier.
    #[must_use = "builder method returns `self`; a discarded result is almost always a bug"]
    pub fn with_trace_id(mut self, trace_id: impl Into<String>) -> Self {
        self.trace_id = Some(trace_id.into());
        self
    }

    /// Set the user identifier.
    #[must_use = "builder method returns `self`; a discarded result is almost always a bug"]
    pub fn with_user_id(mut self, user_id: impl Into<String>) -> Self {
        self.user_id = Some(user_id.into());
        self
    }

    /// Set the organisation identifier.
    #[must_use = "builder method returns `self`; a discarded result is almost always a bug"]
    pub fn with_org_id(mut self, org_id: impl Into<String>) -> Self {
        self.org_id = Some(org_id.into());
        self
    }

    /// Insert a single key-value pair into the metadata bag.
    #[must_use = "builder method returns `self`; a discarded result is almost always a bug"]
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    /// Build the [`Context`], validating that all required fields are present.
    ///
    /// Returns [`ContextError::MissingHeader`] if any of the required
    /// fields (`request_id`, `span_id`, `trace_id`) is unset.
    ///
    /// ```
    /// use pheno_context::Context;
    ///
    /// let err = Context::new().build().expect_err("missing required fields");
    /// assert!(matches!(err, pheno_context::ContextError::MissingHeader(_)));
    /// ```
    #[must_use = "Result-returning; ignoring the Err arm silently masks a missing field"]
    pub fn build(self) -> Result<Context, ContextError> {
        let request_id = self
            .request_id
            .ok_or_else(|| ContextError::MissingHeader("request_id".to_string()))?;
        let span_id = self
            .span_id
            .ok_or_else(|| ContextError::MissingHeader("span_id".to_string()))?;
        let trace_id = self
            .trace_id
            .ok_or_else(|| ContextError::MissingHeader("trace_id".to_string()))?;

        Ok(Context {
            request_id,
            span_id,
            trace_id,
            user_id: self.user_id,
            org_id: self.org_id,
            metadata: self.metadata,
        })
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_header(headers: &HeaderMap, name: &str) -> Result<String, ContextError> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(String::from)
        .ok_or_else(|| ContextError::MissingHeader(name.to_string()))
}

fn extract_header_optional(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(String::from)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use http::HeaderValue;

    #[test]
    fn builder_sets_all_fields() {
        let ctx = Context::new()
            .with_request_id("req-1")
            .with_span_id("span-1")
            .with_trace_id("trace-1")
            .with_user_id("user-1")
            .with_org_id("org-1")
            .with_metadata("key1", "val1")
            .with_metadata("key2", "val2")
            .build()
            .unwrap();

        assert_eq!(ctx.request_id, "req-1");
        assert_eq!(ctx.span_id, "span-1");
        assert_eq!(ctx.trace_id, "trace-1");
        assert_eq!(ctx.user_id, Some("user-1".to_string()));
        assert_eq!(ctx.org_id, Some("org-1".to_string()));
        assert_eq!(ctx.metadata.get("key1"), Some(&"val1".to_string()));
        assert_eq!(ctx.metadata.get("key2"), Some(&"val2".to_string()));
    }

    #[test]
    fn from_headers_extracts_known_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("X-Request-ID", HeaderValue::from_static("req-42"));
        headers.insert("X-Trace-ID", HeaderValue::from_static("trace-42"));
        headers.insert("X-Span-ID", HeaderValue::from_static("span-42"));
        headers.insert("X-User-ID", HeaderValue::from_static("user-42"));
        headers.insert("X-Org-ID", HeaderValue::from_static("org-42"));

        let ctx = Context::from_headers(&headers).unwrap();
        assert_eq!(ctx.request_id, "req-42");
        assert_eq!(ctx.trace_id, "trace-42");
        assert_eq!(ctx.span_id, "span-42");
        assert_eq!(ctx.user_id, Some("user-42".to_string()));
        assert_eq!(ctx.org_id, Some("org-42".to_string()));
        assert!(ctx.metadata.is_empty());
    }

    #[test]
    fn from_headers_missing_request_id_returns_error() {
        let mut headers = HeaderMap::new();
        headers.insert("X-Trace-ID", HeaderValue::from_static("trace-42"));
        headers.insert("X-Span-ID", HeaderValue::from_static("span-42"));

        let err = Context::from_headers(&headers).unwrap_err();
        assert!(
            matches!(err, ContextError::MissingHeader(ref h) if h == "X-Request-ID"),
            "expected MissingHeader for X-Request-ID, got {err}"
        );
    }

    #[test]
    fn clone_preserves_all_fields() {
        let ctx = Context::new()
            .with_request_id("req-1")
            .with_span_id("span-1")
            .with_trace_id("trace-1")
            .with_user_id("user-1")
            .with_org_id("org-1")
            .with_metadata("k", "v")
            .build()
            .unwrap();

        let cloned = ctx.clone();
        assert_eq!(ctx, cloned);
    }

    #[test]
    fn display_renders_key_value_pairs() {
        let ctx = Context::new()
            .with_request_id("req-1")
            .with_span_id("span-1")
            .with_trace_id("trace-1")
            .with_user_id("user-1")
            .with_org_id("org-1")
            .with_metadata("k", "v")
            .build()
            .unwrap();

        let s = ctx.to_string();
        assert!(s.contains("request_id=req-1"), "display: {s}");
        assert!(s.contains("span_id=span-1"), "display: {s}");
        assert!(s.contains("trace_id=trace-1"), "display: {s}");
        assert!(s.contains("user_id=user-1"), "display: {s}");
        assert!(s.contains("org_id=org-1"), "display: {s}");
        assert!(s.contains("metadata={"), "display: {s}");
    }
}
