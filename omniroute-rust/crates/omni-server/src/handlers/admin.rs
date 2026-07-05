//! Admin / observability endpoints: /metrics, /.well-known/agent.json, A2A, me.

use axum::extract::{Path, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::{json, Value};

use crate::App;
use crate::ServerError;

pub async fn metrics() -> impl IntoResponse {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        "# HELP omniroute_up Server is up\n# TYPE omniroute_up gauge\nomniroute_up 1\n",
    )
}

pub async fn agent_card() -> Result<Json<Value>, ServerError> {
    Ok(Json(json!({
        "name": "OmniRoute",
        "description": "Unified AI router — 160+ providers, OpenAI-compatible",
        "version": "0.1.0",
        "skills": [
            {"id": "chat", "name": "Chat", "description": "Multi-model chat completions"},
            {"id": "embeddings", "name": "Embeddings", "description": "Vector embeddings"},
            {"id": "rerank", "name": "Rerank", "description": "Document reranking"},
            {"id": "moderation", "name": "Moderation", "description": "Content moderation"},
            {"id": "transcription", "name": "Transcription", "description": "Audio transcription"},
            {"id": "speech", "name": "Speech", "description": "Text-to-speech"}
        ],
        "endpoints": {
            "chat": "/v1/chat/completions",
            "embeddings": "/v1/embeddings",
            "models": "/v1/models"
        }
    })))
}

pub async fn agents_health() -> Json<Value> {
    Json(json!({"status": "ok", "agents": 0}))
}

pub async fn submit_task(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({
        "id": "task-stub",
        "state": "pending",
        "input": body
    }))
}

pub async fn get_task(Path(id): Path<String>) -> Json<Value> {
    Json(json!({
        "id": id,
        "state": "pending",
        "input": null,
        "output": null
    }))
}

pub async fn me_status(State(app): State<App>) -> Json<Value> {
    Json(json!({
        "name": app.server_info.name,
        "version": app.server_info.version,
        "providers": app.registry.len(),
    }))
}
