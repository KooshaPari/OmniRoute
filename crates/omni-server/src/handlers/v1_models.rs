//! /v1/models endpoints — list and fetch.

use axum::extract::{Path, State};
use axum::Json;
use serde_json::{json, Value};

use crate::App;
use crate::ServerError;

pub async fn list_models(State(app): State<App>) -> Result<Json<Value>, ServerError> {
    let mut models: Vec<Value> = Vec::new();
    for h in app.registry.list() {
        for m in &h.models {
            if m == "*" {
                continue;
            }
            models.push(json!({
                "id": m,
                "object": "model",
                "created": 0,
                "owned_by": h.id.0,
            }));
        }
    }
    Ok(Json(json!({"object": "list", "data": models})))
}

pub async fn get_model(
    State(app): State<App>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ServerError> {
    for h in app.registry.list() {
        for m in &h.models {
            if m == &id || (m.ends_with('*') && id.starts_with(&m[..m.len() - 1])) {
                return Ok(Json(json!({
                    "id": m,
                    "object": "model",
                    "created": 0,
                    "owned_by": h.id.0,
                })));
            }
        }
    }
    Err(ServerError::NotFound(id))
}
