//! Health and readiness endpoints.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

use crate::App;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub uptime_secs: u64,
    pub version: &'static str,
    pub build_sha: &'static str,
}

pub async fn healthz(State(app): State<App>) -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        uptime_secs: app.uptime_secs(),
        version: env!("CARGO_PKG_VERSION"),
        build_sha: "dev",
    })
}

pub async fn readyz(State(app): State<App>) -> impl IntoResponse {
    if app.is_ready() {
        (StatusCode::OK, Json(serde_json::json!({"status": "ready"})))
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"status": "not_ready"})))
    }
}
