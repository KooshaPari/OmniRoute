use async_trait::async_trait;
use std::time::Duration;

use tokio::time::sleep;

use crate::error::{Error, ErrorKind};
use crate::executor::{Executor, ExecutorCapabilities, ExecutorRequest, ExecutorResponse};
use crate::provider::ProviderId;

/// Configuration for the retry behaviour of a `RetryingExecutor`.
///
/// Default: 2 max attempts, 250 ms base delay, 32 s cap, jitter true, only retry on
/// `Upstream` / `Timeout` / `RateLimited` errors.
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of attempts (including the initial call).  Must be >= 1.
    pub max_attempts: u32,
    /// Base delay for exponential backoff (doubled each attempt).
    pub base_delay_ms: u64,
    /// Maximum total backoff before giving up.
    pub max_delay_ms: u64,
    /// If true, adds ± 25 % jitter to each backoff.
    pub jitter: bool,
    /// If true, also retry on [`ErrorKind::Client`] 4xx errors (default: false).
    pub retry_client_errors: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 2,
            base_delay_ms: 250,
            max_delay_ms: 32_000,
            jitter: true,
            retry_client_errors: false,
        }
    }
}

/// An executor wrapper that adds exponential-backoff retry logic to an inner executor.
///
/// Failures that should NOT be retried (e.g. auth errors, unsupported models) are
/// passed through immediately.
pub struct RetryingExecutor {
    inner: Box<dyn Executor + Send + Sync>,
    config: RetryConfig,
}

impl RetryingExecutor {
    pub fn new(inner: Box<dyn Executor + Send + Sync>) -> Self {
        Self {
            inner,
            config: RetryConfig::default(),
        }
    }

    pub fn with_config(inner: Box<dyn Executor + Send + Sync>, config: RetryConfig) -> Self {
        Self { inner, config }
    }

    /// Returns `true` if the error should be retried according to the current config.
    fn should_retry(&self, err: &Error) -> bool {
        match err.kind() {
            ErrorKind::UpstreamUnavailable
            | ErrorKind::UpstreamTimeout
            | ErrorKind::UpstreamStatus(_)
            | ErrorKind::RateLimited => true,
            ErrorKind::BadRequest => self.config.retry_client_errors,
            ErrorKind::Unauthorized
            | ErrorKind::Forbidden
            | ErrorKind::NotFound
            | ErrorKind::ConfigInvalid
            | ErrorKind::Other
            | ErrorKind::NotImplemented
            | ErrorKind::Internal
            | ErrorKind::Db
            | ErrorKind::Conflict => false,
        }
    }
}

#[async_trait]
impl Executor for RetryingExecutor {
    fn provider_id(&self) -> ProviderId {
        self.inner.provider_id()
    }

    fn capabilities(&self) -> ExecutorCapabilities {
        self.inner.capabilities()
    }

    fn models(&self) -> &[String] {
        self.inner.models()
    }

    async fn execute(&self, request: ExecutorRequest) -> Result<ExecutorResponse, Error> {
        let mut last_err: Option<Error> = None;
        let mut delay_ms = self.config.base_delay_ms;

        for attempt in 1..=self.config.max_attempts {
            match self.inner.execute(request.clone()).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    if attempt == self.config.max_attempts || !self.should_retry(&e) {
                        return Err(e);
                    }
                    last_err = Some(e);
                }
            }

            // Cap the delay at max_delay_ms.
            let cap = delay_ms.min(self.config.max_delay_ms);
            if self.config.jitter {
                // ± 25 % jitter: multiply by 0.75..1.25
                let jitter_factor = 0.75 + (rand::random::<f64>() * 0.5);
                let actual = (cap as f64 * jitter_factor) as u64;
                sleep(Duration::from_millis(actual)).await;
            } else {
                sleep(Duration::from_millis(cap)).await;
            }

            delay_ms = delay_ms.saturating_mul(2);
        }

        Err(last_err.unwrap_or_else(|| Error::upstream("retry loop exhausted")))
    }
}

// --------------------------------------------------------------------------- //
// TESTS
// --------------------------------------------------------------------------- //

#[cfg(test)]
mod tests {
    use super::*;
    use crate::executor::ExecutorRequest;

    /// A mock executor that fails the first N times, then succeeds.
    struct MockFlakyExecutor {
        fail_count: u32,
        called: std::sync::atomic::AtomicU32,
    }

    impl MockFlakyExecutor {
        fn new(fail_count: u32) -> Self {
            Self {
                fail_count,
                called: std::sync::atomic::AtomicU32::new(0),
            }
        }
    }

    #[async_trait]
    impl Executor for MockFlakyExecutor {
        fn provider_id(&self) -> ProviderId {
            ProviderId::from("mock-flaky")
        }

        fn capabilities(&self) -> ExecutorCapabilities {
            ExecutorCapabilities::default()
        }

        fn models(&self) -> &[String] {
            &[]
        }

        async fn execute(&self, _request: ExecutorRequest) -> Result<ExecutorResponse, Error> {
            let c = self
                .called
                .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
                + 1;
            if c <= self.fail_count {
                Err(Error::upstream("mock failure"))
            } else {
                Ok(ExecutorResponse::Streaming(Box::pin(
                    futures::stream::empty(),
                )))
            }
        }
    }

    #[tokio::test]
    async fn retries_on_upstream_error_and_succeeds() {
        let inner = MockFlakyExecutor::new(1);
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 1,
            max_delay_ms: 100,
            jitter: false,
            ..Default::default()
        };
        let retrying = RetryingExecutor::with_config(Box::new(inner), config);

        let req = ExecutorRequest::default();
        let result = retrying.execute(req).await;
        assert!(result.is_ok(), "expected Ok after retry, got {result:?}");
    }

    #[tokio::test]
    async fn does_not_retry_auth_errors() {
        struct AuthEx;
        #[async_trait]
        impl Executor for AuthEx {
            fn provider_id(&self) -> ProviderId {
                ProviderId::from("auth-ex")
            }
            fn capabilities(&self) -> ExecutorCapabilities {
                ExecutorCapabilities::default()
            }
            fn models(&self) -> &[String] {
                &[]
            }
            async fn execute(&self, _: ExecutorRequest) -> Result<ExecutorResponse, Error> {
                Err(Error::unauthorized("bad key"))
            }
        }

        let retrying = RetryingExecutor::with_config(
            Box::new(AuthEx),
            RetryConfig {
                max_attempts: 5,
                ..Default::default()
            },
        );
        let req = ExecutorRequest::default();
        let result = retrying.execute(req).await;
        assert!(result.is_err(), "expected Err for auth error");
        assert!(result.unwrap_err().to_string().contains("unauthorized"),);
    }

    #[tokio::test]
    async fn max_attempts_exhaustion_returns_last_error() {
        let inner = MockFlakyExecutor::new(10);
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 1,
            max_delay_ms: 100,
            jitter: false,
            ..Default::default()
        };
        let retrying = RetryingExecutor::with_config(Box::new(inner), config);

        let req = ExecutorRequest::default();
        let result = retrying.execute(req).await;
        assert!(result.is_err(), "expected Err (exhausted), got {result:?}");
    }

    #[tokio::test]
    async fn single_attempt_passes_through() {
        let inner = MockFlakyExecutor::new(0);
        let config = RetryConfig {
            max_attempts: 1,
            ..Default::default()
        };
        let retrying = RetryingExecutor::with_config(Box::new(inner), config);

        let req = ExecutorRequest::default();
        let result = retrying.execute(req).await;
        assert!(
            result.is_ok(),
            "expected Ok on first attempt, got {result:?}"
        );
    }

    #[tokio::test]
    async fn default_config_is_reasonable() {
        let cfg = RetryConfig::default();
        assert_eq!(cfg.max_attempts, 2);
        assert_eq!(cfg.base_delay_ms, 250);
        assert!(cfg.jitter);
    }
}
