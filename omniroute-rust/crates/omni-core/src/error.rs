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
            Self::UpstreamStatus(code) => 502,
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
                | Self::UpstreamStatus(429)
                | Self::UpstreamStatus(500..=504)
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

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::NotFound, message: message.into() }
    }

    pub fn upstream(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::UpstreamUnavailable, message: message.into() }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::WithKind { kind: ErrorKind::Internal, message: message.into() }
    }

    /// Build an error with an explicit kind (for kinds without a dedicated constructor).
    pub fn with_kind(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self::WithKind { kind, message: message.into() }
    }
}

pub type Result<T> = std::result::Result<T, Error>;
