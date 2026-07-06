use std::fmt;

use serde::{Deserialize, Serialize};

/// Stable error kind used for HTTP status mapping, retry decisions, and metrics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorKind {
    /// 4xx — caller did something wrong.
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    RateLimited,
    /// 5xx — upstream provider did something wrong.
    UpstreamUnavailable,
    UpstreamTimeout,
    UpstreamStatus(u16),
    /// 5xx — we did something wrong.
    Internal,
    NotImplemented,
    ConfigInvalid,
    Db,
    /// Catch-all for the rare unclassified case.
    Other,
}

impl ErrorKind {
    #[must_use]
    pub fn http_status(self) -> u16 {
        match self {
            Self::BadRequest => 400,
            Self::Unauthorized => 401,
            Self::Forbidden => 403,
            Self::NotFound => 404,
            Self::Conflict => 409,
            Self::RateLimited => 429,
            Self::UpstreamUnavailable | Self::UpstreamTimeout => 502,
            Self::UpstreamStatus(code) if (500..600).contains(&code) => code,
            Self::UpstreamStatus(_) => 502,
            Self::Internal | Self::Db => 500,
            Self::NotImplemented => 501,
            Self::ConfigInvalid => 500,
            Self::Other => 500,
        }
    }

    #[must_use]
    pub fn is_retryable(self) -> bool {
        matches!(
            self,
            Self::UpstreamUnavailable
                | Self::UpstreamTimeout
                | Self::UpstreamStatus(429 | 500..=504)
                | Self::RateLimited
        )
    }

    #[must_use]
    pub fn is_provider_fault(self) -> bool {
        matches!(self, Self::UpstreamUnavailable | Self::UpstreamTimeout)
            || matches!(self, Self::UpstreamStatus(c) if c >= 500)
    }
}

impl fmt::Display for ErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::BadRequest => write!(f, "bad_request"),
            Self::Unauthorized => write!(f, "unauthorized"),
            Self::Forbidden => write!(f, "forbidden"),
            Self::NotFound => write!(f, "not_found"),
            Self::Conflict => write!(f, "conflict"),
            Self::RateLimited => write!(f, "rate_limited"),
            Self::UpstreamUnavailable => write!(f, "upstream_unavailable"),
            Self::UpstreamTimeout => write!(f, "upstream_timeout"),
            Self::UpstreamStatus(c) => write!(f, "upstream_status_{c}"),
            Self::Internal => write!(f, "internal"),
            Self::NotImplemented => write!(f, "not_implemented"),
            Self::ConfigInvalid => write!(f, "config_invalid"),
            Self::Db => write!(f, "db"),
            Self::Other => write!(f, "other"),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{kind}: {message}")]
    WithKind { kind: ErrorKind, message: String },

    #[error("config: {0}")]
    Config(String),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("db: {0}")]
    Db(#[from] sqlx::Error),

    #[error("http: {0}")]
    Http(#[from] reqwest::Error),

    #[error("url: {0}")]
    Url(#[from] url::ParseError),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

impl Error {
    #[must_use]
    pub fn kind(&self) -> ErrorKind {
        match self {
            Self::WithKind { kind, .. } => *kind,
            Self::Config(_) | Self::Url(_) => ErrorKind::ConfigInvalid,
            Self::Io(_) => ErrorKind::Internal,
            Self::Json(_) => ErrorKind::BadRequest,
            Self::Db(_) => ErrorKind::Db,
            Self::Http(_) => ErrorKind::UpstreamUnavailable,
            Self::Other(e) => {
                if let Some(inner) = e.downcast_ref::<Error>() {
                    inner.kind()
                } else {
                    ErrorKind::Other
                }
            }
        }
    }

    #[must_use]
    pub fn http_status(&self) -> u16 {
        self.kind().http_status()
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::BadRequest, message: message.into() }
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::Unauthorized, message: message.into() }
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::Forbidden, message: message.into() }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::NotFound, message: message.into() }
    }

    pub fn rate_limited(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::RateLimited, message: message.into() }
    }

    pub fn upstream(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::UpstreamUnavailable, message: message.into() }
    }

    pub fn upstream_status(message: impl Into<String>, status: u16) -> Self {
        Self::WithKind {
            kind: ErrorKind::UpstreamStatus(status),
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::Internal, message: message.into() }
    }

    /// Build an error with an explicit kind (for kinds without a dedicated constructor).
    pub fn with_kind(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self::WithKind { kind, message: message.into() }
    }

    /// Returns true when this error originates from the caller's request
    /// (4xx-equivalent) rather than from the provider.
    #[must_use]
    pub fn is_client_fault(&self) -> bool {
        let code = self.http_status();
        (400..500).contains(&code)
    }

    /// Returns true when this error originates from the upstream provider
    /// (5xx-equivalent, excluding 501 NotImplemented which is our fault).
    #[must_use]
    pub fn is_upstream_fault(&self) -> bool {
        self.kind().is_provider_fault()
    }

    /// Stable string code (machine-friendly) for logs, metrics, and retry routing.
    /// Inverse of `Display for ErrorKind`.
    #[must_use]
    pub fn stable_code(&self) -> String {
        self.kind().to_string()
    }
}

impl From<ErrorKind> for Error {
    fn from(kind: ErrorKind) -> Self {
        Self::with_kind(kind, "")
    }
}

pub type Result<T> = std::result::Result<T, Error>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constructors_set_expected_kind_and_message() {
        assert_eq!(Error::bad_request("a").kind(), ErrorKind::BadRequest);
        assert_eq!(Error::unauthorized("a").kind(), ErrorKind::Unauthorized);
        assert_eq!(Error::forbidden("a").kind(), ErrorKind::Forbidden);
        assert_eq!(Error::not_found("a").kind(), ErrorKind::NotFound);
        assert_eq!(Error::rate_limited("a").kind(), ErrorKind::RateLimited);
        assert_eq!(Error::upstream("a").kind(), ErrorKind::UpstreamUnavailable);
        assert_eq!(
            Error::upstream_status("a", 503).kind(),
            ErrorKind::UpstreamStatus(503)
        );
        assert_eq!(Error::internal("a").kind(), ErrorKind::Internal);
        assert_eq!(
            Error::with_kind(ErrorKind::Other, "a").kind(),
            ErrorKind::Other
        );
        assert_eq!(
            Error::with_kind(ErrorKind::Other, "msg").stable_code(),
            "other"
        );
    }

    #[test]
    fn http_status_matches_kind() {
        assert_eq!(Error::bad_request("x").http_status(), 400);
        assert_eq!(Error::unauthorized("x").http_status(), 401);
        assert_eq!(Error::forbidden("x").http_status(), 403);
        assert_eq!(Error::not_found("x").http_status(), 404);
        assert_eq!(Error::rate_limited("x").http_status(), 429);
        assert_eq!(Error::upstream("x").http_status(), 502);
        assert_eq!(Error::upstream_status("x", 503).http_status(), 503);
        assert_eq!(Error::upstream_status("x", 404).http_status(), 502);
        assert_eq!(Error::internal("x").http_status(), 500);
    }

    #[test]
    fn is_retryable_and_provider_fault_logic() {
        assert!(ErrorKind::UpstreamUnavailable.is_retryable());
        assert!(ErrorKind::UpstreamTimeout.is_retryable());
        assert!(ErrorKind::RateLimited.is_retryable());
        assert!(ErrorKind::UpstreamStatus(500).is_retryable());
        assert!(ErrorKind::UpstreamStatus(503).is_retryable());
        assert!(ErrorKind::UpstreamStatus(504).is_retryable());
        assert!(!ErrorKind::UpstreamStatus(404).is_retryable());
        assert!(!ErrorKind::BadRequest.is_retryable());

        assert!(ErrorKind::UpstreamUnavailable.is_provider_fault());
        assert!(ErrorKind::UpstreamStatus(500).is_provider_fault());
        assert!(!ErrorKind::BadRequest.is_provider_fault());
    }

    #[test]
    fn client_vs_upstream_classification() {
        assert!(Error::bad_request("x").is_client_fault());
        assert!(Error::forbidden("x").is_client_fault());
        assert!(Error::rate_limited("x").is_client_fault());
        assert!(!Error::bad_request("x").is_upstream_fault());

        assert!(Error::upstream("x").is_upstream_fault());
        assert!(Error::upstream_status("x", 500).is_upstream_fault());
        assert!(!Error::upstream("x").is_client_fault());

        assert!(!Error::internal("x").is_client_fault());
        assert!(!Error::internal("x").is_upstream_fault());
    }

    #[test]
    fn from_error_kind_yields_empty_message() {
        let e: Error = ErrorKind::RateLimited.into();
        assert_eq!(e.kind(), ErrorKind::RateLimited);
        assert_eq!(e.http_status(), 429);
    }

    #[test]
    fn display_for_kind_roundtrips_via_stable_code() {
        for k in [
            ErrorKind::BadRequest,
            ErrorKind::Unauthorized,
            ErrorKind::Forbidden,
            ErrorKind::NotFound,
            ErrorKind::Conflict,
            ErrorKind::RateLimited,
            ErrorKind::UpstreamUnavailable,
            ErrorKind::UpstreamTimeout,
            ErrorKind::Internal,
            ErrorKind::NotImplemented,
            ErrorKind::ConfigInvalid,
            ErrorKind::Db,
            ErrorKind::Other,
        ] {
            // Each must round-trip back through Display
            let display = k.to_string();
            let reconstructed: ErrorKind = serde_json::from_str(&format!(
                "\"{display}\""
            ))
            .expect("kind must round-trip via Display + serde");
            assert_eq!(reconstructed, k, "round-trip failed for {display}");
        }
    }

    #[test]
    fn upstream_status_round_trips_via_serde_only() {
        // UpstreamStatus carries a u16, so its Display is "upstream_status_<code>"
        // (human-friendly) but serde expects the structured tuple form.
        let k = ErrorKind::UpstreamStatus(503);
        let s = serde_json::to_string(&k).expect("serialize");
        let parsed: ErrorKind = serde_json::from_str(&s).expect("parse back");
        assert_eq!(parsed, k);

        // Display form is intentionally human-friendly and does NOT round-trip
        // back to the structured variant via serde (only Display round-trips).
        assert_eq!(k.to_string(), "upstream_status_503");
    }
}
