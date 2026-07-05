use std::collections::BTreeMap;
use std::pin::Pin;

use async_trait::async_trait;
use futures::Stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::error::Result;
use crate::provider::ProviderId;

/// What an executor needs to do one turn.
#[derive(Debug, Clone)]
pub struct ExecutorRequest {
    pub request_id: Uuid,
    pub provider: ProviderId,
    pub model: String,
    /// Provider-shaped body. The translator is responsible for turning the
    /// client wire format into this shape.
    pub body: Value,
    /// Headers supplied by the client. Executor may add / override.
    pub headers: BTreeMap<String, String>,
    pub stream: bool,
    pub timeout: Option<std::time::Duration>,
}

/// Either a single final response or a stream of incremental events.
pub enum ExecutorResponse {
    Complete(CompleteResponse),
    Streaming(Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteResponse {
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub body: Value,
    pub usage: Option<UsageMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    /// SSE-style payload already shaped for the client.
    pub data: String,
    /// Optional structured event metadata (transient; not sent on the wire).
    pub event: Option<String>,
    /// Set on the terminal event of the stream.
    pub terminal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsageMetrics {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub cost_usd: Option<f64>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct ExecutorCapabilities {
    pub supports_streaming: bool,
    pub supports_tools: bool,
    pub supports_vision: bool,
    pub supports_reasoning: bool,
    pub supports_system_role: bool,
}

/// The trait every provider executor implements.
///
/// Executors must be:
/// - **Send + Sync** (registered in a global map)
/// - **Stateless across requests** (auth / pool state lives in services)
/// - **Cancellation-aware** (drop the future to cancel)
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
