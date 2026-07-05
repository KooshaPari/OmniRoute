//! omni-sdk: typed Rust client for the OmniRoute gateway.
//!
//! Surface mirrors the OpenAI-compatible chat completions + embeddings API
//! that OmniRoute exposes. Provider-agnostic: pass any model id; the
//! gateway routes it. Streaming is supported for chat.
//!
//! ```no_run
//! use omni_sdk::Client;
//! # async fn run() -> Result<(), omni_sdk::SdkError> {
//! let client = Client::builder("http://localhost:8080").api_key("sk-test").build()?;
//! let resp = client.chat()
//!     .model("gpt-4o-mini")
//!     .user("ping")
//!     .send()
//!     .await?;
//! println!("{}", resp.content());
//! # Ok(()) }
//! ```

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod chat;
pub mod client;
pub mod embeddings;
pub mod error;
pub mod models;

pub use chat::{ChatRequest, ChatResponse, Message, Role, StreamEvent};
pub use client::{Client, ClientBuilder};
pub use embeddings::{EmbedRequest, EmbedResponse};
pub use error::{SdkError, SdkResult};
pub use models::{Model, ModelList};
