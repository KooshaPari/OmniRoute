//! Anthropic Messages-compatible HTTP handlers.
//!
//! Wire-compatible with the Anthropic Messages API. The body is parsed as
//! JSON, dispatched through the dispatcher (which translates the
//! provider-side wire as needed), and the response is shaped to the
//! Anthropic Messages response format.

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde_json::Value;
use tracing::info;
use uuid::Uuid;

use crate::dispatcher::{count_tokens_for_messages, DispatchOutcome, Dispatcher};
use crate::state::{App, AuthKey, ServerError as SE};

/// `POST /v1/messages` — Anthropic Messages. The dispatcher handles the
/// provider translation; the handler just shapes the response.
pub async fn messages(
    State(app): State<App>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, SE> {
    let request_id = request_id_from(&headers);
    let auth: Option<AuthKey> = None;
    let stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let dispatcher = Dispatcher::new(app);
    let outcome = dispatcher
        .dispatch_anthropic_messages(body, stream, request_id, auth.as_ref())
        .await?;
    match outcome {
        DispatchOutcome::Json(v) => Ok(Json(v)),
        DispatchOutcome::Sse(_) => {
            // The handler returns Sse for stream=true; for v0.1 we only
            // support non-streaming, so reaching here means the dispatcher
            // was asked for a stream but returned one. Return the raw
            // value (caller can re-shape if needed).
            Err(SE::Internal("anthropic streaming not yet implemented in v0.1".into()))
        }
        DispatchOutcome::JsonLines(_) => {
            Err(SE::Internal("unexpected json-lines outcome for anthropic".into()))
        }
    }
}

/// `POST /v1/messages/count_tokens` — counts input tokens using
/// `tiktoken-rs` (cl100k_base) as a v0.1 approximation. Provider-precise
/// counting lands in v0.2.
pub async fn count_tokens(
    State(_app): State<App>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, SE> {
    let outcome = count_tokens_for_messages(&body).await?;
    match outcome {
        DispatchOutcome::Json(v) => Ok(Json(v)),
        _ => Err(SE::Internal("count_tokens returned non-JSON outcome".into())),
    }
}

fn request_id_from(headers: &HeaderMap) -> Uuid {
    headers
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::new_v4)
}
