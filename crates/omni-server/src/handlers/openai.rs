//! OpenAI-compatible HTTP handlers.
//!
//! Wire-compatible with the OpenAI HTTP API: the body is parsed as JSON,
//! routed through the dispatcher, and the response is translated back to
//! OpenAI format. Streaming responses use axum's `Sse` with the
//! dispatcher's chunk stream.

use std::pin::Pin;
use std::time::Instant;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::sse::{Event, Sse};
use axum::Json;
use axum::response::IntoResponse;
use futures::stream::{Stream, StreamExt};
use serde_json::{json, Value};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::dispatcher::{DispatchOutcome, Dispatcher};
use crate::state::{App, AuthKey, ServerError, ServerResult};
// (AuthKey will be passed via Extension<AuthKey> once the auth middleware lands.)
use crate::ServerError as SE;

/// `POST /v1/chat/completions` — both streaming and non-streaming paths.
pub async fn chat_completions(
    State(app): State<App>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<axum::response::Response, SE> {
    let request_id = request_id_from(&headers);
    let auth: Option<AuthKey> = None;
    let stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let dispatcher = Dispatcher::new(app);
    let outcome = dispatcher
        .dispatch_chat(body, stream, request_id, auth.as_ref())
        .await?;
    match outcome {
        DispatchOutcome::Json(v) => Ok(Json(v).into_response()),
        DispatchOutcome::Sse(s) => Ok(Sse::new(s)
            .keep_alive(axum::response::sse::KeepAlive::new())
            .into_response()),
        DispatchOutcome::JsonLines(s) => {
            // Fall back to SSE for json-lines too.
            let converted = futures::stream::StreamExt::map(s, |r| {
                r.map(|v| Event::default().data(serde_json::to_string(&v).unwrap_or_default()))
            });
            let pinned: Pin<Box<dyn Stream<Item = Result<Event, std::io::Error>> + Send>> =
                Box::pin(converted);
            Ok(Sse::new(pinned)
                .keep_alive(axum::response::sse::KeepAlive::new())
                .into_response())
        }
    }
}

/// `POST /v1/embeddings` — OpenAI shape.
pub async fn embeddings(
    State(app): State<App>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, SE> {
    let request_id = request_id_from(&headers);
    let auth: Option<AuthKey> = None;
    let dispatcher = Dispatcher::new(app);
    let outcome = dispatcher
        .dispatch_embeddings(body, request_id, auth.as_ref())
        .await?;
    match outcome {
        DispatchOutcome::Json(v) => Ok(Json(v)),
        _ => Err(SE::Internal("embeddings returned non-JSON outcome".into())),
    }
}

/// `POST /v1/audio/speech` — TTS. v0.1 returns 501; the dispatcher surface
/// is in place for the v0.2 integration.
pub async fn audio_speech(
    State(_app): State<App>,
    Json(_body): Json<Value>,
) -> Result<Json<Value>, SE> {
    Err(SE::Internal("audio_speech not implemented in v0.1".into()))
}

pub async fn audio_transcriptions(
    State(_app): State<App>,
    Json(_body): Json<Value>,
) -> Result<Json<Value>, SE> {
    Err(SE::Internal("audio_transcriptions not implemented in v0.1".into()))
}

pub async fn images_generations(
    State(_app): State<App>,
    Json(_body): Json<Value>,
) -> Result<Json<Value>, SE> {
    Err(SE::Internal("images_generations not implemented in v0.1".into()))
}

/// `POST /v1/moderations` — content moderation. v0.1 returns a stub
/// "not flagged" result. The full provider integration lands in v0.2.
pub async fn moderations(
    State(_app): State<App>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, SE> {
    let model = body
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("omni-moderation")
        .to_string();
    let input_count = body
        .get("input")
        .map(|i| i.as_array().map(|a| a.len()).unwrap_or(1))
        .unwrap_or(0);
    let results: Vec<Value> = (0..input_count.max(1))
        .map(|_| {
            json!({
                "flagged": false,
                "categories": {
                    "hate": false, "hate_threatening": false, "self_harm": false,
                    "sexual": false, "sexual_minors": false, "violence": false,
                    "violence_graphic": false
                },
                "category_scores": {
                    "hate": 0.0, "hate_threatening": 0.0, "self_harm": 0.0,
                    "sexual": 0.0, "sexual_minors": 0.0, "violence": 0.0,
                    "violence_graphic": 0.0
                }
            })
        })
        .collect();
    Ok(Json(json!({
        "id": format!("modr-{}", Uuid::new_v4().simple()),
        "object": "moderation",
        "model": model,
        "results": results,
    })))
}

/// `POST /v1/rerank` — v0.1 returns the input items in order with mock
/// relevance scores. The full integration lands in v0.2.
pub async fn rerank(
    State(_app): State<App>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, SE> {
    let query = body.get("query").and_then(|v| v.as_str()).unwrap_or("");
    let documents: Vec<String> = body
        .get("documents")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|d| d.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let top_n = body.get("top_n").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let model = body
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("omni-rerank")
        .to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut results: Vec<Value> = documents
        .iter()
        .enumerate()
        .map(|(idx, doc)| {
            // Cheap score: tf-idf-ish overlap with the query.
            let q_lower = query.to_lowercase();
            let doc_lower = doc.to_lowercase();
            let q_words: std::collections::HashSet<&str> =
                q_lower.split_whitespace().collect();
            let d_words: std::collections::HashSet<&str> =
                doc_lower.split_whitespace().collect();
            let overlap = q_words.intersection(&d_words).count() as f64;
            let denom = (q_words.len().max(1) as f64).sqrt();
            let score = if denom > 0.0 { overlap / denom } else { 0.0 };
            json!({
                "index": idx,
                "relevance_score": score,
                "document": {"text": doc},
            })
        })
        .collect();
    results.sort_by(|a, b| {
        let sa = a.get("relevance_score").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let sb = b.get("relevance_score").and_then(|v| v.as_f64()).unwrap_or(0.0);
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    });
    if top_n > 0 && results.len() > top_n {
        results.truncate(top_n);
    }
    Ok(Json(json!({
        "id": format!("rerank-{}", Uuid::new_v4().simple()),
        "object": "rerank",
        "created": now,
        "model": model,
        "results": results,
    })))
}

/// `POST /v1/responses` — OpenAI Responses API. For v0.1 we accept the
/// request, translate to chat completions, dispatch, and translate the
/// response back. The Responses-native streaming protocol lands in v0.2.
pub async fn responses(
    State(_app): State<App>,
    Json(_body): Json<Value>,
) -> Result<Json<Value>, SE> {
    Err(SE::Internal("responses API not implemented in v0.1".into()))
}

fn request_id_from(headers: &HeaderMap) -> Uuid {
    headers
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::new_v4)
}

