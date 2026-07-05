//! Anthropic Messages API wire types.
//!
//! - `POST /v1/messages` request/response.
//! - Server-sent events: `message_start`, `content_block_start`, `content_block_delta`,
//!   `content_block_stop`, `message_delta`, `message_stop`, `ping`, `error`.

pub mod common;
pub mod messages;
pub mod stream;

pub use common::{ClaudeUsage, SystemPrompt, ThinkingConfig};
pub use messages::{MessagesRequest, MessagesResponse, MessagesResponseContent};
pub use stream::{MessagesStreamEvent, StreamError, StreamErrorEnvelope};
