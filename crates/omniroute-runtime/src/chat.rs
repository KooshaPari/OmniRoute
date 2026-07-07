//! `/v1/chat/completions` handler.
//!
//! Parses the body, dispatches to the named provider, and writes the
//! response (SSE for streaming, JSON for non-streaming). Phase 2 implements
//! the non-streaming path; Phase 3 wires streaming via [`crate::sse`].

use std::sync::Arc;
use std::time::Instant;

use bytes::Bytes;
use hyper::{Request, Response};

use omniroute_core::{
    ChatRequest, Credentials, ProviderError, ProviderRegistry,
};
use crate::metrics::{CircuitOpen, CircuitRegistry, SharedMetrics};
use crate::ResponseBody;

const PROVIDER_HEADER: &str = "x-omniroute-provider";
const API_KEY_HEADER: &str = "x-omniroute-api-key";
const REQUEST_ID_HEADER: &str = "x-omniroute-request-id";

/// Per-provider circuit breakers — module-level singleton. Cheap; just a
/// `Mutex<BTreeMap>` keyed by provider ID.
static CIRCUIT_BREAKERS: once_cell::sync::Lazy<CircuitRegistry> =
    once_cell::sync::Lazy::new(CircuitRegistry::default);

/// Handle `POST /v1/chat/completions`.
///
/// # Errors
///
/// Returns an HTTP 400 if the body is not valid JSON or missing `model` /
/// `messages`. Returns 502 with the upstream's body if the provider errors.
pub async fn chat_completions(
    registry: Arc<ProviderRegistry>,
    metrics: SharedMetrics,
    req: Request<hyper::body::Incoming>,
) -> Response<ResponseBody> {
    let started = Instant::now();
    let (parts, body) = req.into_parts();
    let provider_id = match parts
        .headers
        .get(PROVIDER_HEADER)
        .and_then(|v| v.to_str().ok())
    {
        Some(v) if !v.is_empty() => v.to_string(),
        _ => {
            return json_error(400, "missing x-omniroute-provider header");
        }
    };
    let api_key = parts
        .headers
        .get(API_KEY_HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let request_id = parts
        .headers
        .get(REQUEST_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // ─── Circuit breaker admission gate ──────────────────────────────────
    let breaker = CIRCUIT_BREAKERS.for_provider(&provider_id);
    let breaker_state = breaker.state();
    metrics.set_circuit_state(&provider_id, breaker_state);
    if let Err(err) = breaker.try_admit() {
        metrics.record_request(&provider_id, "503", started.elapsed().as_secs_f64());
        metrics.record_error(&provider_id, "circuit_open");
        return circuit_open_response(&err);
    }

    let provider = match registry.get(&provider_id) {
        Some(p) => p,
        None => {
            metrics.record_request(&provider_id, "404", started.elapsed().as_secs_f64());
            return json_error(
                404,
                &format!("unknown provider: {provider_id}"),
            );
        }
    };

    let bytes = match http_body_util::BodyExt::collect(body).await {
        Ok(c) => c.to_bytes(),
        Err(e) => {
            metrics.record_request(&provider_id, "400", started.elapsed().as_secs_f64());
            return json_error(400, &format!("body read error: {e}"));
        }
    };
    let chat_req: ChatRequest = match serde_json::from_slice(&bytes) {
        Ok(r) => r,
        Err(e) => {
            metrics.record_request(&provider_id, "400", started.elapsed().as_secs_f64());
            return json_error(400, &format!("invalid JSON: {e}"));
        }
    };
    if chat_req.messages.is_empty() {
        metrics.record_request(&provider_id, "400", started.elapsed().as_secs_f64());
        return json_error(400, "messages must not be empty");
    }

    let credentials = if api_key.is_empty() {
        Credentials::none()
    } else {
        Credentials::bearer(api_key)
    };
    let ctx = omniroute_core::Context::new(credentials, provider_id.clone(), request_id.clone())
        .with_request_id_metadata(request_id.clone());

    metrics.active_inc(&provider_id);
    let result = provider.chat_completion(&ctx, chat_req).await;
    metrics.active_dec(&provider_id);

    let elapsed = started.elapsed().as_secs_f64();
    match result {
        Ok(resp) => {
            breaker.record_success();
            metrics.set_circuit_state(&provider_id, breaker.state());
            metrics.record_request(&provider_id, "200", elapsed);
            Response::builder()
                .status(200)
                .header("content-type", "application/json")
                .header("x-omniroute-provider", &provider_id)
                .header("x-omniroute-request-id", &request_id)
                .body(ResponseBody::new(Bytes::from(
                    serde_json::to_string(&resp).unwrap_or_else(|_| "{}".to_string()),
                )))
                .expect("static response")
        }
        Err(e) => {
            breaker.record_failure();
            metrics.set_circuit_state(&provider_id, breaker.state());
            metrics.record_error(&provider_id, error_kind(&e));
            metrics.record_request(&provider_id, &status_class(&e), elapsed);
            http_status_for_error(&provider_id, &e)
        }
    }
}

fn error_kind(err: &ProviderError) -> &'static str {
    match err {
        ProviderError::AuthFailed { .. } => "auth_failed",
        ProviderError::RateLimited { .. } => "rate_limited",
        ProviderError::Timeout { .. } => "timeout",
        ProviderError::Unavailable { .. } => "unavailable",
        ProviderError::UpstreamError { .. } => "upstream_error",
        ProviderError::StreamError { .. } => "stream_error",
        ProviderError::Internal { .. } => "internal",
    }
}

fn status_class(err: &ProviderError) -> String {
    match err {
        ProviderError::AuthFailed { .. } => "401".into(),
        ProviderError::RateLimited { .. } => "429".into(),
        ProviderError::Timeout { .. } => "504".into(),
        ProviderError::Unavailable { .. } => "502".into(),
        ProviderError::UpstreamError { status, .. } => format!("{status}"),
        ProviderError::StreamError { .. } => "502".into(),
        ProviderError::Internal { .. } => "500".into(),
    }
}

fn circuit_open_response(err: &CircuitOpen) -> Response<ResponseBody> {
    let body = serde_json::json!({
        "error": {
            "message": err.to_string(),
            "code": "circuit_open",
            "provider": err.provider,
            "retry_after_ms": err.cooldown_ms,
        }
    });
    Response::builder()
        .status(503)
        .header("content-type", "application/json")
        .header("retry-after-ms", err.cooldown_ms.to_string())
        .body(ResponseBody::new(Bytes::from(body.to_string())))
        .expect("static response")
}

/// Map a [`ProviderError`] to an HTTP response.
fn http_status_for_error(provider_id: &str, err: &ProviderError) -> Response<ResponseBody> {
    let status = match err {
        ProviderError::AuthFailed { .. } => 401,
        ProviderError::RateLimited { .. } => 429,
        ProviderError::Timeout { .. } => 504,
        ProviderError::Unavailable { .. } => 502,
        ProviderError::UpstreamError { status, .. } => match *status {
            s if s >= 500 => 502,
            _ => 400,
        },
        ProviderError::StreamError { .. } => 502,
        ProviderError::Internal { .. } => 500,
    };
    let body = serde_json::json!({
        "error": {
            "message": err.to_string(),
            "provider": err.provider(),
            "retryable": err.is_retryable(),
        }
    });
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .header("x-omniroute-provider", provider_id)
        .body(ResponseBody::new(Bytes::from(body.to_string())))
        .expect("static response")
}

fn json_error(status: u16, message: &str) -> Response<ResponseBody> {
    let body = serde_json::json!({"error": {"message": message}});
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(ResponseBody::new(Bytes::from(body.to_string())))
        .expect("static response")
}

// Convenience extension kept inline to keep the file dependency-light.
trait ContextExt {
    fn with_request_id_metadata(self, id: String) -> Self;
}

impl ContextExt for omniroute_core::Context {
    fn with_request_id_metadata(mut self, id: String) -> Self {
        self.metadata.insert("request_id".into(), id);
        self
    }
}