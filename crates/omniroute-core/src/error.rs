//! Typed errors and retry classification for OmniRoute provider dispatch.

use std::time::Duration;

use thiserror::Error;

/// Errors that any [`Provider`](crate::provider::Provider) implementation may return.
///
/// Each variant carries enough information for the runtime layer to:
///
/// 1. Decide whether the error is transient ([`is_retryable`](ProviderError::is_retryable)).
/// 2. Emit the right HTTP status code to the client (e.g. 401 vs 429 vs 502).
/// 3. Log structured diagnostic context.
#[derive(Debug, Error)]
pub enum ProviderError {
    /// Upstream returned a non-2xx HTTP response.
    #[error("upstream {provider} returned HTTP {status}: {body}")]
    UpstreamError {
        /// Provider ID (e.g. `"openai"`).
        provider: String,
        /// HTTP status code.
        status: u16,
        /// Response body (truncated to 2 KB by the runtime layer).
        body: String,
    },

    /// Rate-limited. The runtime layer should honour `retry_after` if set.
    #[error("rate limited by {provider}, retry after {retry_after:?}s")]
    RateLimited {
        /// Provider ID.
        provider: String,
        /// Seconds to wait before retrying (parsed from `Retry-After` header).
        retry_after: Option<u64>,
    },

    /// Authentication failed (401/403 or missing credentials).
    #[error("authentication failed for {provider}: {message}")]
    AuthFailed {
        /// Provider ID.
        provider: String,
        /// Diagnostic message.
        message: String,
    },

    /// Streaming error (mid-stream 4xx/5xx, malformed SSE, etc.).
    #[error("stream error from {provider}: {message}")]
    StreamError {
        /// Provider ID.
        provider: String,
        /// Diagnostic message.
        message: String,
    },

    /// Request timed out.
    #[error("request to {provider} timed out after {timeout:?}")]
    Timeout {
        /// Provider ID.
        provider: String,
        /// Configured timeout.
        timeout: Duration,
    },

    /// Engine unavailable (network unreachable, DNS, TCP refused).
    #[error("provider {provider} unavailable: {reason}")]
    Unavailable {
        /// Provider ID.
        provider: String,
        /// Diagnostic message.
        reason: String,
    },

    /// Catch-all for unexpected failures (panic, malformed config).
    #[error("internal error in {provider}: {message}")]
    Internal {
        /// Provider ID.
        provider: String,
        /// Diagnostic message.
        message: String,
    },
}

impl ProviderError {
    /// Returns `true` if the error is transient and a retry is appropriate.
    ///
    /// Retries are limited by [`RetryConfig::max_attempts`]. Idempotent
    /// operations (non-streaming chat completion, models listing) are always
    /// safe to retry; streaming is **not** retried mid-stream.
    pub fn is_retryable(&self) -> bool {
        match self {
            ProviderError::Timeout { .. } => true,
            ProviderError::Unavailable { .. } => true,
            ProviderError::RateLimited { .. } => true,
            ProviderError::UpstreamError { status, .. } if *status >= 500 => true,
            ProviderError::UpstreamError { status, .. } if *status == 408 || *status == 429 => true,
            _ => false,
        }
    }

    /// Returns the provider ID this error is attributed to (for logging).
    pub fn provider(&self) -> &str {
        match self {
            ProviderError::UpstreamError { provider, .. }
            | ProviderError::RateLimited { provider, .. }
            | ProviderError::AuthFailed { provider, .. }
            | ProviderError::StreamError { provider, .. }
            | ProviderError::Timeout { provider, .. }
            | ProviderError::Unavailable { provider, .. }
            | ProviderError::Internal { provider, .. } => provider,
        }
    }
}

/// Exponential-backoff retry configuration.
///
/// Mirrors the TypeScript defaults in `open-sse/executors/base.ts`.
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of attempts (including the first).
    pub max_attempts: u32,
    /// Base delay for the exponential backoff curve, in milliseconds.
    pub base_delay_ms: u64,
    /// Cap on the per-attempt delay, in milliseconds.
    pub max_delay_ms: u64,
    /// Jitter window, in milliseconds (added uniformly to the capped delay).
    pub jitter_ms: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 500,
            max_delay_ms: 10_000,
            jitter_ms: 200,
        }
    }
}

/// Compute the delay before retrying `attempt` (zero-indexed: 0 = first retry).
///
/// Delay = `min(base_delay_ms * 2^attempt, max_delay_ms) + random(0..=jitter_ms)`.
///
/// # Example
///
/// ```
/// use omniroute_core::{RetryConfig, backoff_delay};
/// use std::time::Duration;
///
/// let cfg = RetryConfig::default();
/// assert!(backoff_delay(0, &cfg) >= Duration::from_millis(500));
/// assert!(backoff_delay(0, &cfg) <= Duration::from_millis(500 + 200));
/// ```
pub fn backoff_delay(attempt: u32, cfg: &RetryConfig) -> Duration {
    use rand::Rng;
    let exp = 2u64
        .saturating_pow(attempt)
        .saturating_mul(cfg.base_delay_ms);
    let capped = exp.min(cfg.max_delay_ms);
    let jitter = rand::thread_rng().gen_range(0..=cfg.jitter_ms);
    Duration::from_millis(capped + jitter)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_failed_is_not_retryable() {
        let err = ProviderError::AuthFailed {
            provider: "openai".into(),
            message: "bad key".into(),
        };
        assert!(!err.is_retryable());
        assert_eq!(err.provider(), "openai");
    }

    #[test]
    fn rate_limited_is_retryable() {
        let err = ProviderError::RateLimited {
            provider: "anthropic".into(),
            retry_after: Some(5),
        };
        assert!(err.is_retryable());
    }

    #[test]
    fn upstream_5xx_is_retryable_4xx_is_not() {
        let five = ProviderError::UpstreamError {
            provider: "x".into(),
            status: 503,
            body: "oops".into(),
        };
        let four = ProviderError::UpstreamError {
            provider: "x".into(),
            status: 400,
            body: "bad request".into(),
        };
        let four_two_nine = ProviderError::UpstreamError {
            provider: "x".into(),
            status: 429,
            body: "rate".into(),
        };
        assert!(five.is_retryable());
        assert!(!four.is_retryable());
        assert!(four_two_nine.is_retryable());
    }

    #[test]
    fn backoff_grows_exponentially() {
        let cfg = RetryConfig {
            max_attempts: 5,
            base_delay_ms: 100,
            max_delay_ms: 1_000,
            jitter_ms: 0,
        };
        assert_eq!(backoff_delay(0, &cfg), Duration::from_millis(100));
        assert_eq!(backoff_delay(1, &cfg), Duration::from_millis(200));
        assert_eq!(backoff_delay(2, &cfg), Duration::from_millis(400));
        assert_eq!(backoff_delay(3, &cfg), Duration::from_millis(800));
        assert_eq!(backoff_delay(4, &cfg), Duration::from_millis(1_000)); // capped
    }
}