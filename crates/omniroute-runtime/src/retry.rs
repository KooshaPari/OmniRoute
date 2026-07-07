//! Exponential backoff retry wrapper used by handlers.
//!
//! Wraps any async closure and retries with the supplied [`RetryConfig`].
//! The retry budget is **only** consumed for errors classified as
//! `is_retryable()`.

use std::future::Future;
use std::time::Duration;

use omniroute_core::{ProviderError, RetryConfig, backoff_delay};

/// Run `f` with retry/backoff. Stops on the first success or the first
/// non-retryable error.
///
/// The closure receives the zero-indexed attempt number (`0` for the first
/// call) so it can vary behavior per attempt (e.g. only log on retry).
pub async fn with_retry<F, Fut, T>(
    cfg: &RetryConfig,
    mut f: F,
) -> Result<T, ProviderError>
where
    F: FnMut(u32) -> Fut,
    Fut: Future<Output = Result<T, ProviderError>>,
{
    let mut last_err: Option<ProviderError> = None;
    for attempt in 0..cfg.max_attempts {
        match f(attempt).await {
            Ok(v) => return Ok(v),
            Err(e) => {
                if !e.is_retryable() || attempt + 1 == cfg.max_attempts {
                    return Err(e);
                }
                last_err = Some(e);
            }
        }
        let delay = backoff_delay(attempt, cfg);
        tokio::time::sleep(delay).await;
    }
    Err(last_err.expect("loop must have produced an error if we exit"))
}

/// Total time budget used by a retry loop, including all delays.
///
/// Useful for setting timeouts on upstream calls.
pub fn total_retry_budget(cfg: &RetryConfig) -> Duration {
    let mut total = Duration::from_millis(0);
    for attempt in 0..cfg.max_attempts {
        total += backoff_delay(attempt, cfg);
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn succeeds_on_first_try() {
        let cfg = RetryConfig::default();
        let mut calls = 0;
        let result: Result<u32, ProviderError> =
            with_retry(&cfg, |_| {
                calls += 1;
                async { Ok(42) }
            })
            .await;
        assert_eq!(result.unwrap(), 42);
        assert_eq!(calls, 1);
    }

    #[tokio::test(start_paused = true)]
    async fn retries_on_retryable_then_succeeds() {
        let cfg = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 1,
            max_delay_ms: 5,
            jitter_ms: 0,
        };
        let mut calls = 0u32;
        let result: Result<u32, ProviderError> =
            with_retry(&cfg, |_| {
                calls += 1;
                let c = calls;
                async move {
                    if c < 3 {
                        Err(ProviderError::Unavailable {
                            provider: "x".into(),
                            reason: "test".into(),
                        })
                    } else {
                        Ok(7)
                    }
                }
            })
            .await;
        assert_eq!(result.unwrap(), 7);
        assert_eq!(calls, 3);
    }

    #[tokio::test]
    async fn does_not_retry_on_auth_failed() {
        let cfg = RetryConfig::default();
        let mut calls = 0;
        let result: Result<u32, ProviderError> =
            with_retry(&cfg, |_| {
                calls += 1;
                async {
                    Err(ProviderError::AuthFailed {
                        provider: "x".into(),
                        message: "bad".into(),
                    })
                }
            })
            .await;
        assert!(matches!(result, Err(ProviderError::AuthFailed { .. })));
        assert_eq!(calls, 1);
    }
}