//! The [`Provider`] trait and per-request [`Context`].
//!
//! Mirrors Go `native-clients/omniroute-go/internal/provider/registry/provider.go`
//! line-for-line in method names and semantics. Rust async uses `async_trait`
//! for object-safety so adapters can be stored as `Box<dyn Provider>`.

use std::collections::HashMap;

use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::credentials::Credentials;
use crate::error::ProviderError;
use crate::model::Model;
use crate::types::{ChatRequest, ChatResponse, StreamChunk};

/// A live upstream LLM provider.
///
/// The runtime layer instantiates one provider per logical ID
/// (e.g. `"openai"`, `"anthropic"`, `"gemini"`) and stores it in the
/// [`ProviderRegistry`](crate::provider::ProviderRegistry). Each request
/// is dispatched via the trait methods, with credentials supplied through
/// the [`Context`].
///
/// ## Streaming
///
/// `chat_completion_stream` takes a [`tokio::sync::mpsc::Sender`] so the
/// implementation can write chunks as they arrive from the upstream SSE feed
/// without returning an `impl Stream` (which would require an extra wrapper
/// layer). The runtime owns the receiver side and writes each chunk to the
/// client's response stream.
///
/// Implementations MUST emit at least one `StreamChunk { done: true }`
/// before returning `Ok(())` so the runtime can encode the `data: [DONE]`
/// sentinel on the wire.
#[async_trait]
pub trait Provider: Send + Sync + std::fmt::Debug {
    /// Stable provider ID (e.g. `"openai"`, `"anthropic"`, `"gemini"`).
    fn id(&self) -> &str;

    /// Returns the model catalog this provider currently advertises.
    async fn models(&self, ctx: &Context) -> Result<Vec<Model>, ProviderError>;

    /// Non-streaming completion. Returns the full response body.
    async fn chat_completion(
        &self,
        ctx: &Context,
        req: ChatRequest,
    ) -> Result<ChatResponse, ProviderError>;

    /// Streaming completion. Yields one SSE chunk at a time.
    ///
    /// On success, the implementation MUST send at least one
    /// `StreamChunk { done: true }` before returning `Ok(())`.
    /// The runtime layer translates that sentinel to the wire-level
    /// `data: [DONE]\n\n`.
    async fn chat_completion_stream(
        &self,
        ctx: &Context,
        req: ChatRequest,
        tx: mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError>;

    /// Liveness check — confirms credentials are valid without spending tokens.
    async fn ping(&self, ctx: &Context) -> Result<(), ProviderError>;
}

/// Per-request context passed to every [`Provider`] method.
///
/// Carries credentials, identifiers, and metadata. The runtime layer builds
/// this before dispatch; adapters should treat it as read-only.
///
/// # Example
///
/// ```
/// use omniroute_core::{Context, Credentials};
///
/// let ctx = Context::new(
///     Credentials::bearer("sk-test"),
///     "openai",
///     "req-1",
/// );
/// assert_eq!(ctx.provider_id, "openai");
/// assert_eq!(ctx.request_id, "req-1");
/// ```
#[derive(Debug, Clone)]
pub struct Context {
    /// Resolved credentials for this provider.
    pub credentials: Credentials,
    /// Connection ID — identifies the OmniRoute user connection that owns this request.
    pub connection_id: String,
    /// Provider ID (e.g. `"openai"`).
    pub provider_id: String,
    /// Per-request correlation ID — surfaced in logs and metrics.
    pub request_id: String,
    /// Optional metadata (routing hints, agent mode, combo ID, etc.).
    pub metadata: HashMap<String, String>,
}

impl Context {
    /// Build a minimal context.
    pub fn new(
        credentials: Credentials,
        provider_id: impl Into<String>,
        request_id: impl Into<String>,
    ) -> Self {
        Self {
            credentials,
            connection_id: String::new(),
            provider_id: provider_id.into(),
            request_id: request_id.into(),
            metadata: HashMap::new(),
        }
    }

    /// Builder: attach a `connection_id`.
    pub fn with_connection_id(mut self, id: impl Into<String>) -> Self {
        self.connection_id = id.into();
        self
    }

    /// Builder: add a metadata entry.
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

/// Runtime provider registry.
///
/// O(1) lookup by ID; thread-safe via `tokio::sync::RwLock`.
#[derive(Debug, Default)]
pub struct ProviderRegistry {
    inner: std::sync::RwLock<std::collections::HashMap<String, std::sync::Arc<dyn Provider>>>,
}

impl ProviderRegistry {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a provider. Replaces any existing provider with the same ID.
    pub fn register(&self, provider: std::sync::Arc<dyn Provider>) {
        let id = provider.id().to_string();
        self.inner
            .write()
            .expect("ProviderRegistry poisoned")
            .insert(id, provider);
    }

    /// Look up a provider by ID.
    pub fn get(&self, id: &str) -> Option<std::sync::Arc<dyn Provider>> {
        self.inner
            .read()
            .expect("ProviderRegistry poisoned")
            .get(id)
            .cloned()
    }

    /// List all registered provider IDs (sorted).
    pub fn ids(&self) -> Vec<String> {
        let mut v: Vec<String> = self
            .inner
            .read()
            .expect("ProviderRegistry poisoned")
            .keys()
            .cloned()
            .collect();
        v.sort();
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[derive(Debug)]
    struct StubProvider;

    #[async_trait]
    impl Provider for StubProvider {
        fn id(&self) -> &str {
            "stub"
        }
        async fn models(&self, _ctx: &Context) -> Result<Vec<Model>, ProviderError> {
            Ok(vec![])
        }
        async fn chat_completion(
            &self,
            _ctx: &Context,
            _req: ChatRequest,
        ) -> Result<ChatResponse, ProviderError> {
            unimplemented!()
        }
        async fn chat_completion_stream(
            &self,
            _ctx: &Context,
            _req: ChatRequest,
            _tx: mpsc::Sender<Result<StreamChunk, ProviderError>>,
        ) -> Result<(), ProviderError> {
            unimplemented!()
        }
        async fn ping(&self, _ctx: &Context) -> Result<(), ProviderError> {
            Ok(())
        }
    }

    #[test]
    fn registry_register_get_and_ids() {
        let reg = ProviderRegistry::new();
        reg.register(Arc::new(StubProvider));
        assert!(reg.get("stub").is_some());
        assert!(reg.get("missing").is_none());
        assert_eq!(reg.ids(), vec!["stub".to_string()]);
    }

    #[test]
    fn context_new_and_builders() {
        let ctx = Context::new(Credentials::bearer("sk-x"), "openai", "req-1")
            .with_connection_id("conn-42")
            .with_metadata("combo", "default");
        assert_eq!(ctx.provider_id, "openai");
        assert_eq!(ctx.request_id, "req-1");
        assert_eq!(ctx.connection_id, "conn-42");
        assert_eq!(ctx.metadata.get("combo").map(|s| s.as_str()), Some("default"));
    }
}