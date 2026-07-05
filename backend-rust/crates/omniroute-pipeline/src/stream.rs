//! Pipeline orchestration: request -> provider -> response, with
//! cancellation, optional timeout, and bounded backpressure on the
//! streaming output channel.

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use futures::{Stream, StreamExt};
use omniroute_core::error::{Error, Result};
use omniroute_core::provider::{Provider, ProviderCallContext, StreamEvent};
use omniroute_core::request::{ChatRequest, Usage};
use omniroute_core::response::{ChatStreamChunk, FinishReason};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::error::PipelineError;
use crate::usage::UsageAccumulator;

/// The outcome of a `Pipeline::run` call.
pub enum PipelineOutcome {
    /// Non-streaming: a single final `ChatResponse`.
    Completed(ChatResponse),
    /// Streaming: a stream of `PipelineEvent`s plus a shared
    /// `UsageAccumulator` that the consumer can read at any point.
    Streaming {
        events: Pin<Box<dyn Stream<Item = Result<PipelineEvent>> + Send>>,
        usage: Arc<parking_lot::Mutex<UsageAccumulator>>,
    },
}

/// One chunk of streaming output plus the running usage accumulator value.
#[derive(Debug, Clone)]
pub struct PipelineEvent {
    pub chunk: ChatStreamChunk,
    pub usage: Usage,
}

/// The pipeline. Owns a `dyn Provider` and the backpressure / timeout knobs.
pub struct Pipeline {
    provider: Arc<dyn Provider>,
    backpressure_buffer: usize,
    request_timeout: Option<Duration>,
}

impl Pipeline {
    /// Construct a new pipeline over the given provider.
    pub fn new(provider: Arc<dyn Provider>) -> Self {
        Self {
            provider,
            backpressure_buffer: 32,
            request_timeout: None,
        }
    }

    /// Override the streaming backpressure buffer (default 32).
    pub fn with_backpressure(mut self, n: usize) -> Self {
        self.backpressure_buffer = n;
        self
    }

    /// Set a per-request timeout. `None` means no timeout.
    pub fn with_timeout(mut self, d: Duration) -> Self {
        self.request_timeout = Some(d);
        self
    }

    /// Dispatch the request. Returns `Completed` for non-streaming and
    /// `Streaming` for streaming. The cancellation token aborts the
    /// in-flight call when fired.
    pub async fn run(
        &self,
        ctx: ProviderCallContext,
        req: ChatRequest,
        cancel: CancellationToken,
    ) -> std::result::Result<PipelineOutcome, PipelineError> {
        let wants_stream = req.stream.unwrap_or(false);
        if wants_stream {
            self.run_stream(ctx, req, cancel).await
        } else {
            self.run_non_stream(ctx, req, cancel).await
        }
    }

    async fn run_non_stream(
        &self,
        ctx: ProviderCallContext,
        req: ChatRequest,
        cancel: CancellationToken,
    ) -> std::result::Result<PipelineOutcome, PipelineError> {
        let provider = self.provider.clone();
        let timeout = self.request_timeout;
        let work = async move { provider.chat(&ctx, &req).await };
        let resp = tokio::select! {
            biased;
            _ = cancel.cancelled() => {
                return Err(PipelineError::Cancelled);
            }
            r = maybe_timeout(work, timeout) => r?,
        };
        Ok(PipelineOutcome::Completed(resp))
    }

    async fn run_stream(
        &self,
        ctx: ProviderCallContext,
        req: ChatRequest,
        cancel: CancellationToken,
    ) -> std::result::Result<PipelineOutcome, PipelineError> {
        let mut source = self.provider.chat_stream(&ctx, &req).await?;
        let (tx, rx) = mpsc::channel::<Result<PipelineEvent>>(self.backpressure_buffer);
        let usage_acc = Arc::new(parking_lot::Mutex::new(UsageAccumulator::new()));

        let provider_id = self.provider.metadata().id.to_string();
        let model = req.model.clone();
        let acc_for_task = usage_acc.clone();
        tokio::spawn(async move {
            let mut done = false;
            while let Some(item) = source.next().await {
                if cancel.is_cancelled() {
                    let _ = tx
                        .send(Err(Error::Internal("cancelled".into())))
                        .await;
                    return;
                }
                // Scope the parking_lot guard tightly: snapshot first, then drop
                // the guard before constructing the payload or calling .await.
                let usage_now = acc_for_task.lock().usage();
                let payload: Result<PipelineEvent> = match item {
                    Ok(StreamEvent::Content(text)) => {
                        let chunk = ChatStreamChunk::content_delta(model.clone(), text);
                        Ok(PipelineEvent { chunk, usage: usage_now })
                    }
                    Ok(StreamEvent::Reasoning(text)) => {
                        let chunk = ChatStreamChunk::content_delta(model.clone(), text);
                        Ok(PipelineEvent { chunk, usage: usage_now })
                    }
                    Ok(StreamEvent::ToolCallDelta(_partial)) => {
                        // The tool-call delta is emitted via the first-chunk
                        // shape; downstream consumers that care about the
                        // partial state should subscribe to the provider's
                        // stream directly. Carrying the partial through to
                        // the chunk shape is a v1.1 enhancement.
                        let chunk = ChatStreamChunk::first(model.clone());
                        Ok(PipelineEvent { chunk, usage: usage_now })
                    }
                    Ok(StreamEvent::Usage(u)) => {
                        // Add then snapshot: scope the lock tightly.
                        {
                            let mut g = acc_for_task.lock();
                            g.add(u.clone());
                        }
                        let snap = acc_for_task.lock().usage();
                        let chunk = ChatStreamChunk::final_chunk(
                            model.clone(),
                            FinishReason::Stop,
                            Some(u),
                        );
                        Ok(PipelineEvent { chunk, usage: snap })
                    }
                    Ok(StreamEvent::Done) => {
                        done = true;
                        let snap = acc_for_task.lock().usage();
                        let chunk = ChatStreamChunk::final_chunk(
                            model.clone(),
                            FinishReason::Stop,
                            Some(snap.clone()),
                        );
                        Ok(PipelineEvent { chunk, usage: snap })
                    }
                    Ok(StreamEvent::Error(msg)) => {
                        Err(Error::Upstream {
                            provider: provider_id.clone(),
                            status: None,
                            message: msg,
                        })
                    }
                    Err(e) => Err(e),
                };
                let is_err = payload.is_err();
                if tx.send(payload).await.is_err() {
                    // Receiver dropped.
                    return;
                }
                if is_err {
                    return;
                }
                if done {
                    return;
                }
            }
            if !done {
                // Stream ended without an explicit Done event; emit a final
                // chunk so the consumer's accumulator closes.
                let snap = acc_for_task.lock().usage();
                let chunk = ChatStreamChunk::final_chunk(
                    model,
                    FinishReason::Stop,
                    Some(snap.clone()),
                );
                let _ = tx
                    .send(Ok(PipelineEvent { chunk, usage: snap }))
                    .await;
            }
        });

        let stream = tokio_stream::wrappers::ReceiverStream::new(rx);
        Ok(PipelineOutcome::Streaming {
            events: Box::pin(stream),
            usage: usage_acc,
        })
    }
}

/// A single chat response with all the standard fields, used by tests
/// and any code that needs to construct a `ChatResponse` for fixtures.
pub type ChatResponse = omniroute_core::response::ChatResponse;

async fn maybe_timeout<F>(fut: F, t: Option<Duration>) -> Result<ChatResponse>
where
    F: std::future::Future<Output = Result<ChatResponse>>,
{
    match t {
        Some(d) => tokio::time::timeout(d, fut)
            .await
            .map_err(|_| Error::UpstreamTimeout { provider: "pipeline".into() })?,
        None => fut.await,
    }
}

// ── tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use omniroute_core::format::Format;
    use omniroute_core::model::ModelId;
    use omniroute_core::provider::{ProviderMetadata, StreamEventSource};
    use omniroute_core::request::{
        ChatMessage, ChatRole, EmbeddingRequest, GenerationParams, ImageRequest, MessageContent,
    };
    use omniroute_core::response::{
        ChatChoice, EmbeddingResponse, ImageResponse,
    };
    use std::collections::HashMap;
    use uuid::Uuid;

    fn dummy_metadata(id: &str) -> ProviderMetadata {
        ProviderMetadata {
            id: id.into(),
            display_name: id.into(),
            format: Format::Openai,
            base_url: "http://localhost".into(),
            requires_api_key: false,
            supports_oauth: false,
            supports_streaming: true,
            supports_tools: false,
            supports_vision: false,
            supports_audio: false,
            supports_images: false,
            supports_embeddings: false,
            request_timeout_ms: 0,
            auth_header: None,
            auth_scheme: Some("Bearer".into()),
            anthropic_sse: false,
            model_overrides: HashMap::new(),
            custom_headers: HashMap::new(),
        }
    }

    fn dummy_request() -> ChatRequest {
        ChatRequest {
            model: ModelId::new("gpt-4o-mini"),
            messages: vec![ChatMessage {
                role: ChatRole::User,
                content: Some(MessageContent::Text("hi".into())),
                tool_calls: None,
                tool_call_id: None,
                name: None,
            }],
            stream: Some(false),
            tools: None,
            tool_choice: None,
            response_format: None,
            params: GenerationParams::default(),
            target_format: None,
            combo_id: None,
        }
    }

    fn dummy_response() -> ChatResponse {
        ChatResponse {
            id: "chatcmpl-test".into(),
            object: "chat.completion".into(),
            created: 0,
            model: ModelId::new("gpt-4o-mini"),
            choices: vec![ChatChoice {
                index: 0,
                message: ChatMessage {
                    role: ChatRole::Assistant,
                    content: Some(MessageContent::Text("hello".into())),
                    tool_calls: None,
                    tool_call_id: None,
                    name: None,
                },
                finish_reason: Some(FinishReason::Stop),
                logprobs: None,
            }],
            usage: Usage { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, reasoning_tokens: None, cached_tokens: None },
            served_by: None,
            served_format: None,
            system_fingerprint: None,
        }
    }

    fn dummy_ctx() -> ProviderCallContext {
        ProviderCallContext { request_id: Uuid::new_v4(), credential: "test".into(), metadata: HashMap::new() }
    }

    struct StaticProvider {
        meta: ProviderMetadata,
        chat: ChatResponse,
        stream: Vec<StreamEvent>,
    }

    #[async_trait]
    impl Provider for StaticProvider {
        fn metadata(&self) -> &ProviderMetadata { &self.meta }
        async fn chat(&self, _ctx: &ProviderCallContext, _req: &ChatRequest) -> Result<ChatResponse> {
            Ok(self.chat.clone())
        }
        async fn chat_stream(&self, _ctx: &ProviderCallContext, _req: &ChatRequest) -> Result<StreamEventSource> {
            let evs = self.stream.clone();
            Ok(Box::pin(futures::stream::iter(evs.into_iter().map(Ok))))
        }
        async fn embed(&self, _ctx: &ProviderCallContext, _req: &EmbeddingRequest) -> Result<EmbeddingResponse> {
            unimplemented!()
        }
        async fn image(&self, _ctx: &ProviderCallContext, _req: &ImageRequest) -> Result<ImageResponse> {
            unimplemented!()
        }
    }

    fn mock_provider(stream: Vec<StreamEvent>) -> Arc<StaticProvider> {
        Arc::new(StaticProvider {
            meta: dummy_metadata("mock"),
            chat: dummy_response(),
            stream,
        })
    }

    #[tokio::test]
    async fn pipeline_run_non_stream_returns_response() {
        let p = Pipeline::new(mock_provider(vec![]) as Arc<dyn Provider>);
        let out = p
            .run(dummy_ctx(), dummy_request(), CancellationToken::new())
            .await
            .unwrap();
        match out {
            PipelineOutcome::Completed(r) => assert_eq!(r.id, "chatcmpl-test"),
            _ => panic!("expected Completed"),
        }
    }

    #[tokio::test]
    async fn pipeline_run_stream_emits_chunks_and_final_usage() {
        let events = vec![
            StreamEvent::Content("hel".into()),
            StreamEvent::Content("lo".into()),
            StreamEvent::Usage(Usage {
                prompt_tokens: 5,
                completion_tokens: 3,
                total_tokens: 8,
                reasoning_tokens: None,
                cached_tokens: None,
            }),
            StreamEvent::Done,
        ];
        let p = Pipeline::new(mock_provider(events) as Arc<dyn Provider>);
        let mut req = dummy_request();
        req.stream = Some(true);
        let out = p
            .run(dummy_ctx(), req, CancellationToken::new())
            .await
            .unwrap();
        let stream = match out {
            PipelineOutcome::Streaming { events, .. } => events,
            _ => panic!("expected Streaming"),
        };
        let collected: Vec<_> = stream.collect().await;
        assert!(collected.len() >= 3, "got {} events: {:?}", collected.len(), collected);
        let last = collected.last().unwrap().as_ref().unwrap();
        assert_eq!(last.usage.total_tokens, 8);
    }

    #[tokio::test]
    async fn pipeline_run_cancels_when_token_fires() {
        struct SlowProvider {
            meta: ProviderMetadata,
            chat: ChatResponse,
        }
        #[async_trait]
        impl Provider for SlowProvider {
            fn metadata(&self) -> &ProviderMetadata { &self.meta }
            async fn chat(&self, _ctx: &ProviderCallContext, _req: &ChatRequest) -> Result<ChatResponse> {
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                Ok(self.chat.clone())
            }
            async fn chat_stream(&self, _ctx: &ProviderCallContext, _req: &ChatRequest) -> Result<StreamEventSource> {
                Ok(Box::pin(futures::stream::empty()))
            }
            async fn embed(&self, _ctx: &ProviderCallContext, _req: &EmbeddingRequest) -> Result<EmbeddingResponse> { unimplemented!() }
            async fn image(&self, _ctx: &ProviderCallContext, _req: &ImageRequest) -> Result<ImageResponse> { unimplemented!() }
        }
        let p = Pipeline::new(Arc::new(SlowProvider { meta: dummy_metadata("slow"), chat: dummy_response() }) as Arc<dyn Provider>);
        let token = CancellationToken::new();
        let token_clone = token.clone();
        let cancel_task = tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            token_clone.cancel();
        });
        let start = std::time::Instant::now();
        let result = p.run(dummy_ctx(), dummy_request(), token).await;
        cancel_task.await.unwrap();
        let elapsed = start.elapsed();
        match result {
            Err(PipelineError::Cancelled) => {}
            other => panic!("expected Cancelled, got {other:?}"),
        }
        assert!(elapsed < std::time::Duration::from_secs(2), "took too long: {elapsed:?}");
    }

    #[tokio::test]
    async fn pipeline_run_propagates_provider_error() {
        struct ErrorProvider { meta: ProviderMetadata }
        #[async_trait]
        impl Provider for ErrorProvider {
            fn metadata(&self) -> &ProviderMetadata { &self.meta }
            async fn chat(&self, _ctx: &ProviderCallContext, _req: &ChatRequest) -> Result<ChatResponse> {
                Err(Error::Upstream { provider: "mock".into(), status: Some(503), message: "down".into() })
            }
            async fn chat_stream(&self, _ctx: &ProviderCallContext, _req: &ChatRequest) -> Result<StreamEventSource> {
                Ok(Box::pin(futures::stream::empty()))
            }
            async fn embed(&self, _ctx: &ProviderCallContext, _req: &EmbeddingRequest) -> Result<EmbeddingResponse> { unimplemented!() }
            async fn image(&self, _ctx: &ProviderCallContext, _req: &ImageRequest) -> Result<ImageResponse> { unimplemented!() }
        }
        let p = Pipeline::new(Arc::new(ErrorProvider { meta: dummy_metadata("err") }) as Arc<dyn Provider>);
        let result = p.run(dummy_ctx(), dummy_request(), CancellationToken::new()).await;
        match result {
            Err(PipelineError::Core(Error::Upstream { status: Some(503), .. })) => {}
            other => panic!("expected Upstream(503), got {other:?}"),
        }
    }
}

// Manual Debug impl: `Streaming` holds a `dyn Stream` which does not derive Debug.
impl std::fmt::Debug for PipelineOutcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Completed(r) => f.debug_tuple("Completed").field(r).finish(),
            Self::Streaming { .. } => f.debug_struct("Streaming").finish_non_exhaustive(),
        }
    }
}
