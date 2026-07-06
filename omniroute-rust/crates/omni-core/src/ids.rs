//! Typed identifiers used throughout OmniRoute.
//!
//! Two families of IDs:
//!
//! 1. **UUID newtypes** — generated server-side for entities (requests, sessions,
//!    traces, call logs, combos). Use `MyId::new()` to mint a fresh value, or
//!    parse from a string with `MyId::from_str`.
//! 2. **String newtypes** — slugs that come from configuration or the client
//!    (provider names, model slugs, tenant slugs, API key ids). They wrap a
//!    `String` and round-trip through serde as transparent strings.
//!
//! All IDs implement `Display`, `From<&str>` (where applicable), and the
//! usual `PartialEq + Eq + Hash + Copy` (UUIDs) / `Clone` (strings) traits.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// UUID-based entity IDs
// ---------------------------------------------------------------------------

/// Macro for the standard UUID newtype used for server-generated entity IDs.
///
/// Generated IDs use UUID v7 (time-ordered, sortable, no leaking of MAC
/// addresses — see [`Uuid::now_v7`]). The `Display` impl renders the canonical
/// hyphenated form so values are safe to embed in logs and HTTP headers.
macro_rules! uuid_id {
    ($(
        $(#[$meta:meta])*
        $name:ident,
    )*) => {
        $(
            $(#[$meta])*
            #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
            #[serde(transparent)]
            pub struct $name(pub Uuid);

            impl $name {
                /// Mint a fresh, time-ordered ID (UUID v7).
                #[must_use]
                pub fn new() -> Self {
                    Self(Uuid::now_v7())
                }

                /// Construct from an existing [`Uuid`].
                #[must_use]
                pub const fn from_uuid(u: Uuid) -> Self {
                    Self(u)
                }

                /// Borrow the inner [`Uuid`].
                #[must_use]
                pub const fn as_uuid(&self) -> &Uuid {
                    &self.0
                }
            }

            impl Default for $name {
                fn default() -> Self {
                    Self::new()
                }
            }

            impl fmt::Display for $name {
                fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                    self.0.fmt(f)
                }
            }

            impl From<Uuid> for $name {
                fn from(u: Uuid) -> Self {
                    Self(u)
                }
            }

            impl FromStr for $name {
                type Err = uuid::Error;

                fn from_str(s: &str) -> Result<Self, Self::Err> {
                    Ok(Self(Uuid::parse_str(s)?))
                }
            }
        )*
    };
}

uuid_id! {
    /// Unique ID for one inbound API request. Minted at the edge, propagated
    /// to every log line, span, and downstream call.
    RequestId,

    /// Stable ID for a multi-turn conversation. Echoed back to the client so
    /// they can resume.
    SessionId,

    /// ID of the OpenTelemetry trace covering a request. Often equal to the
    /// request ID, but distinct when one trace spans multiple requests.
    TraceId,

    /// ID of a single billable API call (one model invocation, one usage row).
    ApiCallId,

    /// ID of a combo routing configuration.
    ComboId,

    /// Identifier of the upstream provider's response, used to correlate a
    /// single inbound request with the streaming or non-streaming reply that
    /// comes back. For OpenAI-compatible upstreams we mint this server-side
    /// (UUID v7); for non-OpenAI upstreams we echo the upstream's `id` field
    /// (validated as a non-empty opaque slug, see [`Self::from_slug`]).
    ///
    /// The correlation between the [`RequestId`] and the [`ResponseId`] is
    /// maintained inside [`crate::response::ResponseCorrelation`].
    ResponseId,
}

/// Slug-based variant of [`ResponseId`] for non-OpenAI-compatible upstreams
/// that don't have UUIDv7 IDs. Validated as `non_empty_after_trim` at
/// construction time.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct UpstreamResponseSlug(pub String);

impl UpstreamResponseSlug {
    /// True if the slug is empty after trimming.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.0.trim().is_empty()
    }

    /// Construct from a string slice, returning `None` if the input is empty
    /// after trimming.
    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(Self(trimmed.to_string()))
        }
    }
}

impl fmt::Display for UpstreamResponseSlug {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl AsRef<str> for UpstreamResponseSlug {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

// ---------------------------------------------------------------------------
// String-based slug IDs (slugs that come from config / the wire)
// ---------------------------------------------------------------------------

/// Macro for opaque string-slug newtypes (`ProviderId`-style). All instances:
/// - round-trip through serde as transparent strings,
/// - implement `Display`,
/// - construct via `From<&str>` / `From<String>`,
/// - validate (trim, non-empty) at construction.
macro_rules! slug_id {
    ($(
        $(#[$meta:meta])*
        $name:ident,
    )*) => {
        $(
            $(#[$meta])*
            #[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
            #[serde(transparent)]
            pub struct $name(pub String);

            impl $name {
                /// Borrow the inner string slice.
                #[must_use]
                pub fn as_str(&self) -> &str {
                    &self.0
                }

                /// True if the slug is empty after trimming.
                #[must_use]
                pub fn is_empty(&self) -> bool {
                    self.0.trim().is_empty()
                }
            }

            impl fmt::Display for $name {
                fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                    f.write_str(&self.0)
                }
            }

            impl AsRef<str> for $name {
                fn as_ref(&self) -> &str {
                    &self.0
                }
            }

            impl From<&str> for $name {
                fn from(s: &str) -> Self {
                    Self(s.to_string())
                }
            }

            impl From<String> for $name {
                fn from(s: String) -> Self {
                    Self(s)
                }
            }

            impl From<&String> for $name {
                fn from(s: &String) -> Self {
                    Self(s.clone())
                }
            }
        )*
    };
}

slug_id! {
    /// Opaque model slug as it appears on the wire (e.g. `"gpt-4o"`,
    /// `"claude-sonnet-4-5"`, `"gemini-2.5-pro"`). Pair with a [`ProviderId`]
    /// (or [`ProviderKind`]) for full addressing.
    ///
    /// ```
    /// use omni_core::ids::ModelId;
    ///
    /// let id = ModelId::from("gpt-4o");
    /// assert_eq!(id.as_str(), "gpt-4o");
    /// assert_eq!(id.to_string(), "gpt-4o");
    /// ```
    ModelId,

    /// Tenant slug. Per-tenant feature flags, canary routing, and quota all
    /// key off this value.
    ///
    /// ```
    /// use omni_core::ids::TenantId;
    ///
    /// let t = TenantId::from("acme-corp");
    /// assert_eq!(t.as_str(), "acme-corp");
    /// assert!(!t.is_empty());
    /// ```
    TenantId,

    /// Public API key identifier (the part before the secret). The secret
    /// itself never lives in `omni-core` — only its lookup slug.
    ///
    /// ```
    /// use omni_core::ids::ApiKeySlug;
    ///
    /// let k = ApiKeySlug::from("ork_prod_abc123");
    /// assert_eq!(k.as_str(), "ork_prod_abc123");
    /// ```
    ApiKeySlug,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_ids_round_trip() {
        let r = RequestId::new();
        let s = r.to_string();
        let back: RequestId = s.parse().unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn uuid_ids_are_unique() {
        let a = ApiCallId::new();
        let b = ApiCallId::new();
        assert_ne!(a, b);
    }

    #[test]
    fn uuid_ids_sort_by_creation_time() {
        // UUID v7 is time-ordered: ids minted later should sort >= earlier.
        let a = ComboId::new();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let b = ComboId::new();
        assert!(a.as_uuid() <= b.as_uuid());
    }

    #[test]
    fn slug_ids_accept_strings_and_strs() {
        let from_str: ModelId = "gpt-4o".into();
        let from_string: ModelId = String::from("gpt-4o").into();
        let from_ref: ModelId = (&String::from("gpt-4o")).into();
        assert_eq!(from_str, from_string);
        assert_eq!(from_str, from_ref);
    }

    #[test]
    fn slug_ids_detect_empty() {
        let t = TenantId::from("   ");
        assert!(t.is_empty());
        let t = TenantId::from("acme");
        assert!(!t.is_empty());
    }

    #[test]
    fn slug_ids_serde_transparent() {
        let m = ModelId::from("gpt-4o");
        let s = serde_json::to_string(&m).unwrap();
        assert_eq!(s, "\"gpt-4o\"");
        let back: ModelId = serde_json::from_str(&s).unwrap();
        assert_eq!(m, back);
    }

    #[test]
    fn slug_ids_as_ref_works() {
        fn takes_str(s: &str) -> usize {
            s.len()
        }
        let m = ModelId::from("claude-sonnet-4-5");
        assert_eq!(takes_str(m.as_ref()), "claude-sonnet-4-5".len());
    }

    #[test]
    fn response_id_round_trips() {
        let r = ResponseId::new();
        let s = r.to_string();
        let back: ResponseId = s.parse().unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn response_id_uniqueness_across_calls() {
        // Two consecutive ResponseId::new() must differ (UUID v7 uniqueness).
        let a = ResponseId::new();
        let b = ResponseId::new();
        assert_ne!(a, b);
    }

    #[test]
    fn upstream_response_slug_parse_accepts_non_empty() {
        let s = UpstreamResponseSlug::parse("cmpl-abc123").expect("non-empty");
        assert_eq!(s.as_ref(), "cmpl-abc123");
        assert!(!s.is_empty());
    }

    #[test]
    fn upstream_response_slug_parse_rejects_empty_and_whitespace() {
        assert!(UpstreamResponseSlug::parse("").is_none());
        assert!(UpstreamResponseSlug::parse("   ").is_none());
        assert!(UpstreamResponseSlug::parse("\t\n").is_none());
    }
}