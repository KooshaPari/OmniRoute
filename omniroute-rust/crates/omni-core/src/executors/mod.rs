//! Concrete executor implementations.
//!
//! Each module implements the [`Executor`] trait for a specific provider
//! category (OpenAI-compatible, Anthropic, Gemini, etc.).

mod default_executor;
pub use default_executor::DefaultExecutor;

mod retrying_executor;
pub use retrying_executor::RetryConfig;
pub use retrying_executor::RetryingExecutor;
