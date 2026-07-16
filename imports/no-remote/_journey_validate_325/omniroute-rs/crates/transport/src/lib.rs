//! omniroute-transport: axum 0.8 HTTP surface.
//!
//! Routes:
//!   GET  /health
//!   GET  /openapi.json
//!   POST /v1/chat/completions
//!   POST /v1/tokn/decide   (WP-RS-3: routing decision via HTTP)
//!   GET  /v1/tokn/stats    (WP-RS-3: live impl/version stats)
//!
//! The /v1/tokn/* endpoints expose the same Rust combo resolver that the
//! napi-rs FFI binding wraps (see crates/tokn-ffi). One source of truth;
//! two surfaces (FFI for embed, HTTP for remote).

use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::info;

use omniroute_combo;
use omniroute_core::{ChatRequest, ChatResponse, ProviderError, RouteDecision, RouteRequest};
use omniroute_providers::Registry;

#[derive(Clone)]
pub struct AppState {
    pub registry: Arc<Registry>,
    pub http: reqwest::Client,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/openapi.json", get(openapi))
        .route("/v1/chat/completions", post(chat_completions))
        .route("/v1/tokn/decide", post(tokn_decide))
        .route("/v1/tokn/stats", get(tokn_stats))
        .with_state(state)
}

async fn health() -> &'static str { "ok" }

async fn openapi() -> Json<serde_json::Value> {
    Json(json!({
        "openapi": "3.1.0",
        "info": {
            "title": "omniroute-rs",
            "version": env!("CARGO_PKG_VERSION"),
            "description": "OmniRoute backend (Rust rewrite, first slice + WP-RS-3 tokn HTTP)"
        },
        "paths": {
            "/v1/chat/completions": {
                "post": {
                    "operationId": "createChatCompletion",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/ChatRequest" }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "OK",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ChatResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/v1/tokn/decide": {
                "post": {
                    "operationId": "toknDecide",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/ToknDecideRequest" }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "OK",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ToknDecideResponse" }
                                }
                            }
                        },
                        "400": { "description": "Bad request (missing/invalid model)" }
                    }
                }
            },
            "/v1/tokn/stats": {
                "get": {
                    "operationId": "toknStats",
                    "responses": {
                        "200": {
                            "description": "OK",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ToknStatsResponse" }
                                }
                            }
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "ChatRequest": { "type": "object" },
                "ChatResponse": { "type": "object" },
                "ToknDecideRequest": {
                    "type": "object",
                    "required": ["model"],
                    "properties": {
                        "model": { "type": "string", "description": "Canonical model id, e.g. gpt-4o" },
                        "tenantId": { "type": "string", "description": "Optional. Empty or missing -> _default" }
                    }
                },
                "ToknDecideResponse": {
                    "type": "object",
                    "required": ["provider", "model", "fallbackChain", "source"],
                    "properties": {
                        "provider": { "type": "string" },
                        "model": { "type": "string" },
                        "fallbackChain": { "type": "array", "items": { "type": "string" } },
                        "source": { "type": "string", "enum": ["native", "ts-fallback"] }
                    }
                },
                "ToknStatsResponse": {
                    "type": "object",
                    "required": ["implKind", "version", "healthy"],
                    "properties": {
                        "implKind": { "type": "string", "enum": ["native", "ts-fallback"] },
                        "version": { "type": "string" },
                        "healthy": { "type": "boolean" },
                        "transport": { "type": "string" }
                    }
                }
            }
        }
    }))
}

/// WP-RS-3: routing decision via HTTP. The HTTP surface calls the same
/// `omniroute_combo::resolve` that the napi-rs FFI binding wraps. One source
/// of truth; two surfaces.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToknDecideRequest {
    pub model: String,
    #[serde(default)]
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToknDecideResponse {
    pub provider: String,
    pub model: String,
    pub fallback_chain: Vec<String>,
    pub source: &'static str,
}

impl From<RouteDecision> for ToknDecideResponse {
    fn from(d: RouteDecision) -> Self {
        ToknDecideResponse {
            provider: d.provider,
            model: d.model,
            fallback_chain: d.fallback_chain,
            source: "native",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToknStatsResponse {
    pub impl_kind: &'static str,
    pub version: &'static str,
    pub healthy: bool,
    pub transport: &'static str,
}

async fn tokn_decide(
    Json(req): Json<ToknDecideRequest>,
) -> Result<Json<ToknDecideResponse>, (StatusCode, Json<serde_json::Value>)> {
    if req.model.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "model is required"})),
        ));
    }
    let core_req = RouteRequest {
        model: req.model,
        tenant_id: req
            .tenant_id
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "_default".to_string()),
    };
    let dec = omniroute_combo::resolve(&core_req);
    Ok(Json(dec.into()))
}

async fn tokn_stats() -> Json<ToknStatsResponse> {
    Json(ToknStatsResponse {
        // The HTTP surface IS the native impl; "ts-fallback" only applies to the
        // JS-side lazy loader. We always serve "native" here.
        impl_kind: "native",
        version: env!("CARGO_PKG_VERSION"),
        healthy: true,
        transport: "rust-axum",
    })
}

async fn chat_completions(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, ApiError> {
    let combo = omniroute_combo::resolve(&RouteRequest {
        model: req.model.clone(),
        tenant_id: "_default".to_string(),
    });
    let mut chain = vec![combo.provider.clone()];
    chain.extend(combo.fallback_chain.iter().cloned());

    let mut last_err: Option<ProviderError> = None;
    for provider_name in &chain {
        let Some(p) = state.registry.get(provider_name) else { continue };
        info!(provider = %provider_name, model = %req.model, "trying provider");
        match p.chat(&req).await {
            Ok(r) => return Ok(Json(r)),
            Err(e) => {
                tracing::warn!(provider = %provider_name, error = %e, "provider failed, trying next");
                last_err = Some(e);
            }
        }
    }
    Err(last_err.map(ApiError::from).unwrap_or(ApiError::NoProvider))
}

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("no provider available for the requested model")]
    NoProvider,
    #[error("provider error: {0}")]
    Provider(#[from] ProviderError),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, body) = match &self {
            ApiError::NoProvider => (StatusCode::SERVICE_UNAVAILABLE, json!({"error": "no_provider"})),
            ApiError::Provider(e) => {
                let status = match e {
                    ProviderError::Auth(_) => StatusCode::UNAUTHORIZED,
                    ProviderError::RateLimit(_) => StatusCode::TOO_MANY_REQUESTS,
                    ProviderError::Upstream { status: s, .. } if *s >= 500 => StatusCode::BAD_GATEWAY,
                    ProviderError::Upstream { .. } => StatusCode::BAD_REQUEST,
                    _ => StatusCode::INTERNAL_SERVER_ERROR,
                };
                (status, json!({"error": e.to_string()}))
            }
        };
        (status, Json(body)).into_response()
    }
}
