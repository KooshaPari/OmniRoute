//! OpenAI-compatible wire types.
//!
//! These cover:
//! - `/v1/chat/completions` (used by OpenAI, DeepSeek, Groq, Mistral, OpenRouter,
//!   Fireworks, Together, xAI, Cohere, NVIDIA, Cerebras, and 100+ other providers).
//! - `/v1/responses` (OpenAI Responses API).
//! - `/v1/embeddings`.
//! - `/v1/models`.
//! - OpenAI-style error envelope.

pub mod chat;
pub mod common;
pub mod embeddings;
pub mod error;
pub mod models;
pub mod responses;

pub use chat::{ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse};
pub use common::{
    AssistantMessage, ContentPart, FinishReason, Message, ResponseFormat, StreamOptions, Tool,
    ToolCall, ToolCallFunction, ToolChoice, Usage,
};
pub use embeddings::{Embedding, EmbeddingRequest, EmbeddingResponse, EmbeddingUsage};
pub use error::{ApiError, ApiErrorEnvelope, ApiErrorType};
pub use models::{Model, ModelList};
pub use responses::{
    ResponseInput, ResponseInputItem, ResponseObject, ResponseOutputItem, ResponseRequest,
    ResponseStatus, ResponseStreamEvent,
};
