// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::Result;
use axum::{
    extract::{ConnectInfo, Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::engine::Engine;
use clap::Parser;
use focus_connectors::WebhookRegistry;
use focus_plugin_sdk::{PluginRuntime, RuntimeConfig};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use std::collections::HashMap;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;
use tracing::{debug, error, info, warn};
use std::sync::RwLock;
use chrono::{DateTime, Utc};

mod handler;
mod rate_limit;

/// Per-connector health metrics
#[derive(Debug, Clone, Serialize)]
struct ConnectorHealth {
    last_received_at: Option<DateTime<Utc>>,
    hmac_success_count: u64,
    hmac_failure_count: u64,
    last_hour_count: u64,
}

#[derive(Parser)]
#[command(name = "focalpoint-webhook-server")]
#[command(about = "FocalPoint webhook receiver for GitHub, Canvas, GCal")]
struct Args {
    /// Bind address (default: 127.0.0.1:8472)
    #[arg(long, default_value = "127.0.0.1:8472")]
    bind: String,

    /// Path to core.db (shared with CLI)
    #[arg(long, default_value = "")]
    db: String,
}

#[derive(Clone)]
struct AppState {
    registry: Arc<WebhookRegistry>,
    health_metrics: Arc<RwLock<HashMap<String, ConnectorHealth>>>,
    rate_limiter: Arc<rate_limit::RateLimiter>,
    plugin_runtime: Arc<PluginRuntime>,
    plugin_status: Arc<RwLock<HashMap<String, PluginExecStatus>>>,
}

/// Track concurrent plugin executions (serialized per plugin).
#[derive(Debug, Clone, Serialize)]
struct PluginExecStatus {
    plugin_id: String,
    is_running: bool,
    last_poll_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    timestamp: DateTime<Utc>,
    connectors: HashMap<String, ConnectorHealth>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct WebhookPayload {
    // Generic webhook payload — structure varies per provider
    #[serde(default)]
    #[allow(dead_code)]
    raw: serde_json::Value,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let args = Args::parse();
    info!(bind = %args.bind, "starting focalpoint-webhook-server");

    if !args.db.is_empty() {
        debug!(db_path = %args.db, "using core.db");
    }

    // Initialize rate limiter: 100 req/min per IP
    let rate_limiter = Arc::new(rate_limit::RateLimiter::new());

    // Initialize webhook registry and handlers
    let registry = Arc::new(WebhookRegistry::new());
    register_default_handlers(&registry).await;

    let plugin_runtime = Arc::new(PluginRuntime::new(RuntimeConfig::default())?);

    let state = AppState {
        registry: registry.clone(),
        health_metrics: Arc::new(RwLock::new(HashMap::new())),
        rate_limiter: rate_limiter.clone(),
        plugin_runtime,
        plugin_status: Arc::new(RwLock::new(HashMap::new())),
    };

    // Build router with middleware
    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/webhooks/:connector_id", post(webhook_handler))
        .route("/webhooks/:connector_id/:event_type", post(webhook_handler_with_type))
        .route("/plugins/:plugin_id/poll", post(plugin_poll_handler))
        .with_state(state)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .into_inner(),
        )
        .into_make_service_with_connect_info::<SocketAddr>();

    // Bind and serve
    let listener = tokio::net::TcpListener::bind(&args.bind).await?;
    info!(
        bind = %args.bind,
        "listening for webhook deliveries"
    );

    axum::serve(listener, app).await?;

    Ok(())
}

async fn healthz(State(state): State<AppState>) -> impl IntoResponse {
    let metrics = state.health_metrics.read().unwrap().clone();
    Json(HealthResponse {
        status: "ok".to_string(),
        timestamp: Utc::now(),
        connectors: metrics,
    })
}

async fn webhook_handler(
    Path(connector_id): Path<String>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    body: bytes::Bytes,
) -> impl IntoResponse {
    // Rate limiting: 100 req/min per IP
    if !state.rate_limiter.allow(addr.ip()) {
        warn!(ip = %addr.ip(), "rate limit exceeded");
        return (StatusCode::TOO_MANY_REQUESTS, "rate limit exceeded").into_response();
    }

    debug!(connector_id = %connector_id, "received webhook");

    // Extract headers as HashMap for handler
    let mut header_map = std::collections::HashMap::new();
    for (key, value) in headers.iter() {
        if let Ok(v) = value.to_str() {
            header_map.insert(key.to_string().to_lowercase(), v.to_string());
        }
    }

    // Dispatch to handler
    let result = handler::handle_webhook(&state.registry, &connector_id, header_map, body.to_vec()).await;

    // Update health metrics
    {
        let mut metrics = state.health_metrics.write().unwrap();
        let health = metrics.entry(connector_id.clone()).or_insert(ConnectorHealth {
            last_received_at: None,
            hmac_success_count: 0,
            hmac_failure_count: 0,
            last_hour_count: 0,
        });
        health.last_received_at = Some(Utc::now());
        health.last_hour_count += 1;

        match &result {
            Ok(_) => health.hmac_success_count += 1,
            Err(handler::WebhookError::SignatureInvalid) => health.hmac_failure_count += 1,
            _ => {}
        }
    }

    match result {
        Ok(_events) => {
            debug!(connector_id = %connector_id, "webhook processed successfully");
            (StatusCode::ACCEPTED, "").into_response()
        }
        Err(handler::WebhookError::SignatureInvalid) => {
            warn!(connector_id = %connector_id, "invalid webhook signature");
            (StatusCode::UNAUTHORIZED, "invalid signature").into_response()
        }
        Err(handler::WebhookError::UnknownConnector) => {
            warn!(connector_id = %connector_id, "unknown connector");
            (StatusCode::NOT_FOUND, "unknown connector").into_response()
        }
        Err(e) => {
            error!(connector_id = %connector_id, error = %e, "webhook processing failed");
            (StatusCode::INTERNAL_SERVER_ERROR, "processing error").into_response()
        }
    }
}

/// Generic webhook handler with event-type routing.
async fn webhook_handler_with_type(
    Path((connector_id, event_type)): Path<(String, String)>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    body: bytes::Bytes,
) -> impl IntoResponse {
    // Rate limiting: 100 req/min per IP
    if !state.rate_limiter.allow(addr.ip()) {
        warn!(ip = %addr.ip(), "rate limit exceeded");
        return (StatusCode::TOO_MANY_REQUESTS, "rate limit exceeded").into_response();
    }

    debug!(connector_id = %connector_id, event_type = %event_type, "received webhook with event type");

    // Extract headers as HashMap for handler
    let mut header_map = std::collections::HashMap::new();
    for (key, value) in headers.iter() {
        if let Ok(v) = value.to_str() {
            header_map.insert(key.to_string().to_lowercase(), v.to_string());
        }
    }

    // Dispatch to handler with event type
    let result = handler::handle_webhook_with_type(
        &state.registry,
        &connector_id,
        &event_type,
        header_map,
        body.to_vec(),
    )
    .await;

    // Update health metrics
    {
        let mut metrics = state.health_metrics.write().unwrap();
        let health = metrics.entry(connector_id.clone()).or_insert(ConnectorHealth {
            last_received_at: None,
            hmac_success_count: 0,
            hmac_failure_count: 0,
            last_hour_count: 0,
        });
        health.last_received_at = Some(Utc::now());
        health.last_hour_count += 1;

        match &result {
            Ok(_) => health.hmac_success_count += 1,
            Err(handler::WebhookError::SignatureInvalid) => health.hmac_failure_count += 1,
            _ => {}
        }
    }

    match result {
        Ok(_events) => {
            debug!(connector_id = %connector_id, "webhook processed successfully");
            (StatusCode::ACCEPTED, "").into_response()
        }
        Err(handler::WebhookError::SignatureInvalid) => {
            warn!(connector_id = %connector_id, "invalid webhook signature");
            (StatusCode::UNAUTHORIZED, "invalid signature").into_response()
        }
        Err(handler::WebhookError::UnknownConnector) => {
            warn!(connector_id = %connector_id, "unknown connector");
            (StatusCode::NOT_FOUND, "unknown connector").into_response()
        }
        Err(e) => {
            error!(connector_id = %connector_id, error = %e, "webhook processing failed");
            (StatusCode::INTERNAL_SERVER_ERROR, "processing error").into_response()
        }
    }
}

/// Register default webhook handlers (GitHub, Canvas stub, GCal stub).
/// Reads env vars to configure verifiers; missing env = handler not registered.
async fn register_default_handlers(registry: &WebhookRegistry) {
    // GitHub handler
    if let Ok(secret) = std::env::var("FOCALPOINT_GITHUB_WEBHOOK_SECRET") {
        info!("registering github webhook handler");
        let verifier = Arc::new(
            focus_connectors::signature_verifiers::GitHubHmacVerifier {
                secret: secrecy::SecretString::new(secret.into_boxed_str()),
            },
        );
        let handler = Arc::new(handler::GitHubHandlerImpl {
            account_id: uuid::Uuid::nil(), // TODO: extract from config
            verifier,
        });
        registry.register("github", handler);
    } else {
        warn!("FOCALPOINT_GITHUB_WEBHOOK_SECRET not set; github handler not registered");
    }

    // Canvas handler with full JWT verification
    if let Ok(jwks_url) = std::env::var("FOCALPOINT_CANVAS_JWKS_URL") {
        info!("registering canvas webhook handler");
        let mut verifier = focus_connectors::signature_verifiers::CanvasLtiVerifier::new(jwks_url);

        // Optional: configure expected issuer and audience
        if let Ok(iss) = std::env::var("FOCALPOINT_CANVAS_ISS") {
            verifier = verifier.with_iss(iss);
        }
        if let Ok(aud) = std::env::var("FOCALPOINT_CANVAS_AUD") {
            verifier = verifier.with_aud(aud);
        }

        let verifier = Arc::new(verifier);
        let handler = Arc::new(handler::CanvasHandlerImpl {
            account_id: uuid::Uuid::nil(),
            verifier,
        });
        registry.register("canvas", handler);
    } else {
        warn!("FOCALPOINT_CANVAS_JWKS_URL not set; canvas handler not registered");
    }

    // GCal handler (stub)
    if let Ok(channel_token) = std::env::var("FOCALPOINT_GCAL_CHANNEL_TOKEN") {
        info!("registering google calendar webhook handler (stub)");
        let verifier = Arc::new(
            focus_connectors::signature_verifiers::GCalChannelVerifier {
                channel_token: secrecy::SecretString::new(channel_token.into_boxed_str()),
            },
        );
        let handler = Arc::new(handler::GCalHandlerImpl {
            account_id: uuid::Uuid::nil(),
            verifier,
        });
        registry.register("gcal", handler);
    } else {
        warn!("FOCALPOINT_GCAL_CHANNEL_TOKEN not set; gcal handler not registered");
    }
}

/// Plugin poll handler: `POST /plugins/:id/poll`
/// Invokes WASM plugin, returns NDJSON events, serializes per-plugin exec.
#[derive(Debug, Deserialize)]
struct PluginPollRequest {
    /// Configuration JSON (e.g., credentials)
    #[serde(default)]
    config: serde_json::Value,
    /// WASM module bytes (base64-encoded)
    #[serde(default)]
    wasm: String,
}

#[derive(Debug, Serialize)]
struct PluginPollResponse {
    events: Vec<serde_json::Value>,
    executed_at: DateTime<Utc>,
}

async fn plugin_poll_handler(
    Path(plugin_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<PluginPollRequest>,
) -> impl IntoResponse {
    // Check if plugin is already running (serialize per-plugin)
    {
        let mut status = state.plugin_status.write().unwrap();
        let entry = status.entry(plugin_id.clone()).or_insert(PluginExecStatus {
            plugin_id: plugin_id.clone(),
            is_running: false,
            last_poll_at: None,
        });

        if entry.is_running {
            warn!(plugin_id = %plugin_id, "plugin already executing; skipping");
            return (
                StatusCode::CONFLICT,
                Json(serde_json::json!({"error": "plugin already executing"})),
            )
                .into_response();
        }

        entry.is_running = true;
    }

    // Mark as done when this scope exits
    let _cleanup = CleanupGuard::new(state.plugin_status.clone(), plugin_id.clone());

    // Decode WASM bytes
    let wasm_bytes = match BASE64_STANDARD.decode(&req.wasm) {
        Ok(b) => b,
        Err(e) => {
            error!(plugin_id = %plugin_id, error = %e, "failed to decode wasm");
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "invalid base64 wasm"})),
            )
                .into_response();
        }
    };

    // Load module
    let module = match state.plugin_runtime.load_module(&wasm_bytes) {
        Ok(m) => m,
        Err(e) => {
            error!(plugin_id = %plugin_id, error = %e, "failed to load module");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "module load failed"})),
            )
                .into_response();
        }
    };

    // Serialize config as JSON bytes
    let config_json = serde_json::to_vec(&req.config).unwrap_or_default();

    // Poll plugin
    match module.poll(&config_json) {
        Ok(output) => {
            // Parse NDJSON output
            let mut events = Vec::new();
            for line in String::from_utf8_lossy(&output).lines() {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                    events.push(val);
                }
            }

            info!(
                plugin_id = %plugin_id,
                event_count = events.len(),
                "plugin poll completed"
            );

            (
                StatusCode::OK,
                Json(PluginPollResponse {
                    events,
                    executed_at: Utc::now(),
                }),
            )
                .into_response()
        }
        Err(e) => {
            error!(plugin_id = %plugin_id, error = ?e, "plugin poll failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "plugin execution failed"})),
            )
                .into_response()
        }
    }
}

/// RAII guard to mark plugin as not-running on scope exit.
struct CleanupGuard {
    status: Arc<RwLock<HashMap<String, PluginExecStatus>>>,
    plugin_id: String,
}

impl CleanupGuard {
    fn new(
        status: Arc<RwLock<HashMap<String, PluginExecStatus>>>,
        plugin_id: String,
    ) -> Self {
        Self { status, plugin_id }
    }
}

impl Drop for CleanupGuard {
    fn drop(&mut self) {
        if let Ok(mut status) = self.status.write() {
            if let Some(entry) = status.get_mut(&self.plugin_id) {
                entry.is_running = false;
                entry.last_poll_at = Some(Utc::now());
            }
        }
    }
}
