pub mod chat;
pub mod health;
pub mod metrics;
#[cfg(feature = "otel")]
pub mod otel;
pub mod retry;
pub mod server;
pub mod sse;

pub use chat::chat_completions;
pub use health::{healthz, readyz};
pub use metrics::Metrics;
#[cfg(feature = "otel")]
pub use otel::{init_from_env, TelemetryGuard};
pub use omniroute_core::RetryConfig;
pub use retry::backoff_delay;
pub use server::{ResponseBody, Server};
pub use sse::encode_sse;
