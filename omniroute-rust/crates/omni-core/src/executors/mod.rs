//! Concrete executor implementations.
//!
//! Each module implements the [`Executor`] trait for a specific provider
//! category (OpenAI-compatible, Anthropic, Gemini, etc.).

mod default_executor;
pub use default_executor::DefaultExecutor;
