//! `/v1/chat/completions` handler.
//!
//! Parses the body, dispatches to the named provider, and writes the
//! response (SSE for streaming, JSON for non-streaming). Phase 2 implements
//! the non-streaming path; Phase 3 wires streaming via [`crate::sse`].

use std::sync::Arc;

use bytes::Bytes;
use hyper::{Request, Response};

use omniroute_core::{
    ChatRequest, Credentials, ProviderError, ProviderRegistry,
};
use crate::ResponseBody;

const PROVIDER_HEADER: &str = "x-omniroute-provider";
const API_KEY_HEADER: &str = "x-omniroute-api-key";
const REQUEST_ID_HEADER: &str = "x-omniroute-request-id";

/// Handle `POST /v1/chat/completions`.
///
/// # Errors
///
/// Returns an HTTP 400 if the body is not valid JSON or missing `model` /
/// `messages`. Returns 502 with the upstream's body if the provider errors.
pub async fn chat_completions(
    registry: Arc<ProviderRegistry>,
    req: Request<hyper::body::Incoming>,
) -> Response<ResponseBody> {
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

    let provider = match registry.get(&provider_id) {
        Some(p) => p,
        None => {
            return json_error(
                404,
                &format!("unknown provider: {provider_id}"),
            );
        }
    };

    let bytes = match http_body_util::BodyExt::collect(body).await {
        Ok(c) => c.to_bytes(),
        Err(e) => return json_error(400, &format!("body read error: {e}")),
    };
    let chat_req: ChatRequest = match serde_json::from_slice(&bytes) {
        Ok(r) => r,
        Err(e) => return json_error(400, &format!("invalid JSON: {e}")),
    };
    if chat_req.messages.is_empty() {
        return json_error(400, "messages must not be empty");
    }

    let credentials = if api_key.is_empty() {
        Credentials::none()
    } else {
        Credentials::bearer(api_key)
    };
    let ctx = omniroute_core::Context::new(credentials, provider_id.clone(), request_id.clone())
        .with_request_id_metadata(request_id.clone());

    match provider.chat_completion(&ctx, chat_req).await {
        Ok(resp) => Response::builder()
            .status(200)
            .header("content-type", "application/json")
            .header("x-omniroute-provider", &provider_id)
            .header("x-omniroute-request-id", &request_id)
            .body(ResponseBody::new(Bytes::from(
                serde_json::to_string(&resp).unwrap_or_else(|_| "{}".to_string()),
            )))
            .expect("static response"),
        Err(e) => http_status_for_error(&provider_id, &e),
    }
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