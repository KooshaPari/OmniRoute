//! The executor trait and its request / response types.
//!
//! Every provider adapter implements [`Executor`]. Executors must be:
//! - **`Send + Sync`** (registered in a global map),
//! - **stateless across requests** (auth / pool state lives in services),
//! - **cancellation-aware** (drop the future to cancel).
//!
//! Two response shapes are supported:
//! - [`ExecutorResponse::Complete`] — one-shot, full body returned.
//! - [`ExecutorResponse::Streaming`] — async stream of [`StreamEvent`]s.
//!
//! A [`RetryPolicy`] governs automatic retries on transient upstream errors
//! and is consulted by the dispatcher (not by the executor itself).
//!
//! Every public item below has a doctest; run `cargo test --doc -p omni-core`
//! to verify.

use std::collections::BTreeMap;
use std::pin::Pin;
use std::time::Duration;

use async_trait::async_trait;
use futures::Stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::Result;
use crate::ids::{ApiCallId, RequestId, TraceId};
use crate::provider::ProviderId;

/// What an executor needs to do one turn.
///
/// ```
/// use omni_core::executor::ExecutorRequest;
/// use omni_core::ids::{RequestId, TraceId};
/// use omni_core::provider::ProviderId;
/// use serde_json::json;
/// use std::collections::BTreeMap;
///
/// let req = ExecutorRequest {
///     request_id: RequestId::new(),
///     trace_id: TraceId::new(),
///     provider: ProviderId::from("openai"),
///     model: "gpt-4o".into(),
///     body: json!({"messages": []}),
///     headers: BTreeMap::new(),
///     stream: false,
///     timeout: None,
/// };
/// assert!(!req.stream);
/// ```
#[derive(Debug, Clone)]
pub struct ExecutorRequest {
    pub request_id: RequestId,
    pub trace_id: TraceId,
    pub provider: ProviderId,
    pub model: String,
    /// Provider-shaped body. The translator is responsible for turning the
    /// client wire format into this shape.
    pub body: Value,
    /// Headers supplied by the client. Executor may add / override.
    pub headers: BTreeMap<String, String>,
    pub stream: bool,
    pub timeout: Option<Duration>,
}

/// Either a single final response or a stream of incremental events.
///
/// ```
/// use omni_core::executor::{CompleteResponse, ExecutorResponse};
/// use serde_json::json;
/// use std::collections::BTreeMap;
///
/// let complete = ExecutorResponse::Complete(CompleteResponse {
///     status: 200,
///     headers: BTreeMap::new(),
///     body: json!({}),
///     usage: None,
/// });
/// assert!(matches!(complete, ExecutorResponse::Complete(_)));
/// ```
pub enum ExecutorResponse {
    Complete(CompleteResponse),
    Streaming(Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>),
}

/// One-shot response body.
///
/// ```
/// use omni_core::executor::CompleteResponse;
/// use serde_json::json;
/// use std::collections::BTreeMap;
///
/// let r = CompleteResponse {
///     status: 200,
///     headers: BTreeMap::new(),
///     body: json!({"ok": true}),
///     usage: None,
/// };
/// assert_eq!(r.status, 200);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteResponse {
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub body: Value,
    pub usage: Option<UsageMetrics>,
}

/// One incremental SSE-style event.
///
/// ```
/// use omni_core::executor::StreamEvent;
///
/// // `data` constructor for a non-terminal event.
/// let ev = StreamEvent::data("hello");
/// assert_eq!(ev.data, "hello");
/// assert!(!ev.terminal);
///
/// // `terminal` constructor marks the end of the stream.
/// let done = StreamEvent::terminal("[DONE]");
/// assert!(done.terminal);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    /// SSE-style payload already shaped for the client.
    pub data: String,
    /// Optional structured event metadata (transient; not sent on the wire).
    pub event: Option<String>,
    /// Set on the terminal event of the stream.
    pub terminal: bool,
}

impl StreamEvent {
    /// Construct a non-terminal data event.
    #[must_use]
    pub fn data(data: impl Into<String>) -> Self {
        Self { data: data.into(), event: None, terminal: false }
    }

    /// Construct the terminal event of a stream.
    #[must_use]
    pub fn terminal(data: impl Into<String>) -> Self {
        Self { data: data.into(), event: Some("done".into()), terminal: true }
    }

    /// Construct an event with a structured event name (SSE `event:` field).
    #[must_use]
    pub fn named(event: impl Into<String>, data: impl Into<String>) -> Self {
        Self { data: data.into(), event: Some(event.into()), terminal: false }
    }
}

/// Token usage + optional cost, returned by upstream providers.
///
/// ```
/// use omni_core::executor::UsageMetrics;
///
/// let u = UsageMetrics {
///     prompt_tokens: 100,
///     completion_tokens: 50,
///     total_tokens: 150,
///     cost_usd: Some(0.0025),
/// };
/// assert_eq!(u.total_tokens, 150);
/// assert!(u.cost_usd.is_some());
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsageMetrics {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub cost_usd: Option<f64>,
}

/// Capability flags advertised by an executor.
///
/// ```
/// use omni_core::executor::ExecutorCapabilities;
///
/// let caps = ExecutorCapabilities {
///     supports_streaming: true,
///     supports_tools: true,
///     supports_vision: false,
///     supports_reasoning: false,
///     supports_system_role: true,
/// };
/// assert!(caps.supports_streaming);
/// assert!(!caps.supports_vision);
/// ```
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct ExecutorCapabilities {
    pub supports_streaming: bool,
    pub supports_tools: bool,
    pub supports_vision: bool,
    pub supports_reasoning: bool,
    pub supports_system_role: bool,
}

/// Retry policy applied by the dispatcher on transient upstream errors.
///
/// ```
/// use omni_core::executor::RetryPolicy;
/// use std::time::Duration;
///
/// let p = RetryPolicy::default();
/// assert_eq!(p.max_retries, 2);
/// assert_eq!(p.base_delay, Duration::from_millis(250));
///
/// // First attempt = attempt 0.
/// assert_eq!(p.delay_for_attempt(0), Duration::from_millis(0));
///
/// // Subsequent attempts double: 250ms, 500ms, 1s, 2s, 4s, capped at max_delay.
/// assert_eq!(p.delay_for_attempt(1), Duration::from_millis(250));
/// assert_eq!(p.delay_for_attempt(2), Duration::from_millis(500));
/// assert_eq!(p.delay_for_attempt(10), p.max_delay);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RetryPolicy {
    /// Maximum number of retry attempts AFTER the initial one. `0` disables retries.
    pub max_retries: u32,
    /// Base delay before the first retry; subsequent retries double it.
    pub base_delay: Duration,
    /// Cap on any single backoff delay.
    pub max_delay: Duration,
    /// Optional per-request call id; the dispatcher can stamp this into
    /// logs / spans so retries are traceable back to a single request.
    pub call_id: Option<ApiCallId>,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_retries: 2,
            base_delay: Duration::from_millis(250),
            max_delay: Duration::from_secs(30),
            call_id: None,
        }
    }
}

impl RetryPolicy {
    /// No retries — fail fast on the first error.
    #[must_use]
    pub const fn no_retry() -> Self {
        Self {
            max_retries: 0,
            base_delay: Duration::from_millis(0),
            max_delay: Duration::from_millis(0),
            call_id: None,
        }
    }

    /// `true` if at least one retry is permitted.
    #[must_use]
    pub const fn enabled(&self) -> bool {
        self.max_retries > 0
    }

    /// Compute the backoff delay for `attempt` (0 = first try, 1 = first retry, ...).
    ///
    /// Doubles `base_delay` per attempt and clamps to `max_delay`. `attempt 0`
    /// returns zero so the dispatcher can use the same code path for "send"
    /// and "retry" without branching.
    #[must_use]
    pub fn delay_for_attempt(&self, attempt: u32) -> Duration {
        if attempt == 0 || self.base_delay.is_zero() {
            return Duration::from_secs(0);
        }
        // `2u32.pow(attempt - 1)` saturates long before overflow on u32;
        // even at attempt=31, 2^30 fits comfortably in u64.
        let factor = 1u64 << (attempt - 1).min(30);
        // Multiply the FULL duration as nanos (not just the seconds portion)
        // so sub-second base delays like 250ms actually double correctly.
        let nanos = self.base_delay.as_nanos().saturating_mul(u128::from(factor));
        let capped = nanos.min(u128::from(u64::MAX));
        let delay = Duration::from_nanos(capped as u64);
        if delay > self.max_delay { self.max_delay } else { delay }
    }

    /// `true` if `attempt` (0-based) is within the retry budget.
    #[must_use]
    pub const fn should_retry(&self, attempt: u32) -> bool {
        attempt > 0 && attempt <= self.max_retries
    }
}

/// The trait every provider executor implements.
///
/// Implementors must be **`Send + Sync`**, stateless across requests, and
/// cancellation-aware (dropping the future cancels the in-flight call).
///
/// ```no_run
/// use omni_core::executor::{Executor, ExecutorRequest, ExecutorResponse, ExecutorCapabilities};
/// use omni_core::provider::ProviderId;
/// use omni_core::Result;
///
/// async fn dispatch<E: Executor>(exec: &E, req: ExecutorRequest) -> Result<ExecutorResponse> {
///     let _caps = exec.capabilities();
///     let _id = exec.provider_id();
///     exec.execute(req).await
/// }
/// ```
#[async_trait]
pub trait Executor: Send + Sync {
    fn provider_id(&self) -> ProviderId;
    fn capabilities(&self) -> ExecutorCapabilities;
    fn models(&self) -> &[String];

    /// One-shot or streaming call.
    async fn execute(&self, req: ExecutorRequest) -> Result<ExecutorResponse>;

    /// Best-effort: pre-warm any auth/handshake state. Default = no-op.
    async fn warmup(&self) -> Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_policy_default_is_sensible() {
        let p = RetryPolicy::default();
        assert!(p.enabled());
        assert_eq!(p.max_retries, 2);
    }

    #[test]
    fn retry_policy_no_retry_disables() {
        let p = RetryPolicy::no_retry();
        assert!(!p.enabled());
        assert!(!p.should_retry(1));
    }

    #[test]
    fn retry_policy_should_retry_only_within_budget() {
        let p = RetryPolicy { max_retries: 3, ..RetryPolicy::default() };
        assert!(!p.should_retry(0));
        assert!(p.should_retry(1));
        assert!(p.should_retry(3));
        assert!(!p.should_retry(4));
    }

    #[test]
    fn retry_policy_delay_doubles_per_attempt() {
        let p = RetryPolicy {
            base_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(60),
            ..RetryPolicy::default()
        };
        assert_eq!(p.delay_for_attempt(0), Duration::from_secs(0));
        assert_eq!(p.delay_for_attempt(1), Duration::from_millis(100));
        assert_eq!(p.delay_for_attempt(2), Duration::from_millis(200));
        assert_eq!(p.delay_for_attempt(3), Duration::from_millis(400));
        assert_eq!(p.delay_for_attempt(4), Duration::from_millis(800));
    }

    #[test]
    fn retry_policy_delay_clamps_to_max() {
        let p = RetryPolicy {
            base_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(5),
            ..RetryPolicy::default()
        };
        // 1s, 2s, 4s, 8s (clamps to 5s), 16s (clamps to 5s), ...
        assert_eq!(p.delay_for_attempt(1), Duration::from_secs(1));
        assert_eq!(p.delay_for_attempt(2), Duration::from_secs(2));
        assert_eq!(p.delay_for_attempt(3), Duration::from_secs(4));
        assert_eq!(p.delay_for_attempt(4), Duration::from_secs(5));
        assert_eq!(p.delay_for_attempt(20), Duration::from_secs(5));
    }

    #[test]
    fn stream_event_constructors_set_fields() {
        let e = StreamEvent::data("hi");
        assert_eq!(e.data, "hi");
        assert!(!e.terminal);
        assert!(e.event.is_none());

        let e = StreamEvent::terminal("[DONE]");
        assert!(e.terminal);
        assert_eq!(e.event.as_deref(), Some("done"));

        let e = StreamEvent::named("tool_call", "{...}");
        assert_eq!(e.event.as_deref(), Some("tool_call"));
        assert!(!e.terminal);
    }

    #[test]
    fn usage_metrics_default_is_zero() {
        let u = UsageMetrics::default();
        assert_eq!(u.total_tokens, 0);
        assert!(u.cost_usd.is_none());
    }

    #[test]
    fn executor_capabilities_default_is_all_false() {
        let c = ExecutorCapabilities::default();
        assert!(!c.supports_streaming);
        assert!(!c.supports_tools);
        assert!(!c.supports_vision);
        assert!(!c.supports_reasoning);
        assert!(!c.supports_system_role);
    }
}