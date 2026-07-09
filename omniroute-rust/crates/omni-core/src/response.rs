//! Response correlation — joins an inbound [`RequestId`] with the
//! upstream's [`ResponseId`]/`UpstreamResponseSlug` and the trace that's
//! covering it. Used by:
//!
//! - the dispatcher (mint a `ResponseId`, store the correlation),
//! - the executor (echo or fetch the upstream's slug if available),
//! - storage (every `RequestRecord` carries a `ResponseCorrelation` so
//!   a finalizer can rejoin the call log and the chat response),
//! - logging (`tracing` fields are populated from the correlation).
//!
//! The correlation is intentionally small (no payload, no model name)
//! so it stays cheap to copy in the hot path.

use serde::{Deserialize, Serialize};

use crate::ids::{RequestId, ResponseId, TraceId, UpstreamResponseSlug};

/// One-to-one link between the inbound request and the upstream's response.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ResponseCorrelation {
    /// The inbound request ID.
    pub request_id: RequestId,

    /// The trace covering both the inbound request and the dispatch.
    pub trace_id: TraceId,

    /// Either a server-minted UUIDv7 (OpenAI-compatible upstreams that
    /// don't return their own id) or an echo of the upstream's slug
    /// (every other provider). Two arms so we never have to choose
    /// at construction time.
    pub upstream: UpstreamRef,
}

/// Provider-specific identifier of the upstream's response.
///
/// Wire form: `{"kind": "minted", "id": "<uuid>"}` or
/// `{"kind": "echoed", "slug": "<text>"}`. We use struct variants because
/// serde's `#[serde(tag = "kind")]` does not support newtype variants
/// whose payload is itself a newtype.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum UpstreamRef {
    /// Server-minted UUIDv7 (OpenAI-compatible paths where the upstream
    /// does not return a stable id).
    Minted {
        /// The mint.
        id: ResponseId,
    },
    /// Echoed verbatim from the upstream. Carried as a slug because
    /// upstream ids are not guaranteed to be UUIDs.
    Echoed {
        /// The slug.
        slug: UpstreamResponseSlug,
    },
}

impl UpstreamRef {
    /// Stable, cheap string for log/span fields.
    #[must_use]
    pub fn as_label(&self) -> String {
        match self {
            UpstreamRef::Minted { id } => format!("minted:{}", id),
            UpstreamRef::Echoed { slug } => format!("echoed:{}", slug.as_ref()),
        }
    }
}

impl ResponseCorrelation {
    /// Build a correlation for a server-minted response id (OpenAI path).
    #[must_use]
    pub fn minted(request_id: RequestId, trace_id: TraceId) -> Self {
        Self {
            request_id,
            trace_id,
            upstream: UpstreamRef::Minted {
                id: ResponseId::new(),
            },
        }
    }

    /// Build a correlation that echoes a non-empty upstream slug.
    /// Returns `None` if the slug was empty after trimming.
    #[must_use]
    pub fn echoed(request_id: RequestId, trace_id: TraceId, upstream_id: &str) -> Option<Self> {
        UpstreamResponseSlug::parse(upstream_id).map(|slug| Self {
            request_id,
            trace_id,
            upstream: UpstreamRef::Echoed { slug },
        })
    }

    /// True when the upstream returned no usable id and we minted one.
    #[must_use]
    pub fn is_minted(&self) -> bool {
        matches!(self.upstream, UpstreamRef::Minted { .. })
    }

    /// String label for logs and span fields.
    #[must_use]
    pub fn label(&self) -> String {
        format!(
            "req={},trace={},{}",
            self.request_id,
            self.trace_id,
            self.upstream.as_label()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minted_correlation_round_trips_serde() {
        let c = ResponseCorrelation::minted(RequestId::new(), TraceId::new());
        let s = serde_json::to_string(&c).expect("ser");
        let back: ResponseCorrelation = serde_json::from_str(&s).expect("de");
        assert_eq!(c, back);
    }

    #[test]
    fn echoed_correlation_rejects_empty_slugs() {
        assert!(ResponseCorrelation::echoed(RequestId::new(), TraceId::new(), "").is_none());
        assert!(ResponseCorrelation::echoed(RequestId::new(), TraceId::new(), "   ").is_none());
    }

    #[test]
    fn echoed_correlation_accepts_cmpl_slug() {
        let c = ResponseCorrelation::echoed(RequestId::new(), TraceId::new(), "cmpl-abc123")
            .expect("present");
        assert!(!c.is_minted());
        assert!(c.label().contains("echoed:cmpl-abc123"));
    }

    #[test]
    fn minted_correlation_is_minted() {
        let c = ResponseCorrelation::minted(RequestId::new(), TraceId::new());
        assert!(c.is_minted());
        assert!(c.label().starts_with("req="));
        assert!(c.label().contains("trace="));
        assert!(c.label().contains("minted:"));
    }

    #[test]
    fn unminted_vs_echoed_label_distinct() {
        let a = ResponseCorrelation::minted(RequestId::new(), TraceId::new()).label();
        let b = ResponseCorrelation::echoed(RequestId::new(), TraceId::new(), "chatcmpl-xyz")
            .expect("non-empty")
            .label();
        assert_ne!(a, b);
        assert!(a.contains("minted:"));
        assert!(b.contains("echoed:chatcmpl-xyz"));
    }
}
