// SPDX-License-Identifier: MIT OR Apache-2.0

use async_trait::async_trait;
use connector_github::webhook::GitHubWebhookHandler;
use focus_connectors::{
    signature_verifiers::{CanvasLtiVerifier, GCalChannelVerifier, GitHubHmacVerifier, SignatureVerifier},
    ConnectorError, Result, WebhookDelivery, WebhookHandler, WebhookRegistry,
};
use focus_events::NormalizedEvent;
use focus_observability::ConnectorSpanAttrs;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

#[derive(Debug)]
pub enum WebhookError {
    #[allow(dead_code)]
    SignatureInvalid,
    UnknownConnector,
    ProcessingFailed(String),
}

impl std::fmt::Display for WebhookError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebhookError::SignatureInvalid => write!(f, "signature verification failed"),
            WebhookError::UnknownConnector => write!(f, "unknown connector"),
            WebhookError::ProcessingFailed(msg) => write!(f, "processing failed: {}", msg),
        }
    }
}

impl std::error::Error for WebhookError {}

/// Handle a generic webhook delivery by routing to the registered handler.
/// Extracts event kind from standard headers (X-GitHub-Event, X-Canvas-Event, X-Goog-Resource-State).
pub async fn handle_webhook(
    registry: &WebhookRegistry,
    connector_id: &str,
    headers: HashMap<String, String>,
    body: Vec<u8>,
) -> std::result::Result<Vec<NormalizedEvent>, WebhookError> {
    let span_start = Instant::now();
    let handler = registry
        .get(connector_id)
        .ok_or(WebhookError::UnknownConnector)?;

    // Extract event kind from provider-specific headers
    let kind = extract_event_kind(connector_id, &headers);

    let delivery = WebhookDelivery {
        connector_id: connector_id.to_string(),
        kind,
        headers,
        body,
        received_at: chrono::Utc::now(),
    };

    let result = handler
        .handle(&delivery)
        .await
        .map_err(|e| WebhookError::ProcessingFailed(e.to_string()));

    // Record tracing with span attributes
    let duration_ms = span_start.elapsed().as_millis() as u64;
    let attrs = ConnectorSpanAttrs::new(connector_id.to_string())
        .with_state("received".to_string())
        .with_duration(duration_ms);

    if result.is_ok() {
        tracing::info!(
            connector_id = %connector_id,
            state = "received",
            duration_ms = duration_ms,
            span_attrs = ?attrs,
            "webhook.receive span (success)"
        );
    } else {
        tracing::warn!(
            connector_id = %connector_id,
            state = "error",
            duration_ms = duration_ms,
            span_attrs = ?attrs,
            "webhook.receive span (error)"
        );
    }

    result
}

/// Handle a webhook with explicit event type.
pub async fn handle_webhook_with_type(
    registry: &WebhookRegistry,
    connector_id: &str,
    event_type: &str,
    headers: HashMap<String, String>,
    body: Vec<u8>,
) -> std::result::Result<Vec<NormalizedEvent>, WebhookError> {
    let span_start = Instant::now();
    let handler = registry
        .get(connector_id)
        .ok_or(WebhookError::UnknownConnector)?;

    let delivery = WebhookDelivery {
        connector_id: connector_id.to_string(),
        kind: event_type.to_string(),
        headers,
        body,
        received_at: chrono::Utc::now(),
    };

    let result = handler
        .handle(&delivery)
        .await
        .map_err(|e| WebhookError::ProcessingFailed(e.to_string()));

    // Record tracing with span attributes
    let duration_ms = span_start.elapsed().as_millis() as u64;
    let attrs = ConnectorSpanAttrs::new(connector_id.to_string())
        .with_state("received".to_string())
        .with_duration(duration_ms);

    if result.is_ok() {
        tracing::info!(
            connector_id = %connector_id,
            state = "received",
            duration_ms = duration_ms,
            event_type = %event_type,
            span_attrs = ?attrs,
            "webhook.receive span (success)"
        );
    } else {
        tracing::warn!(
            connector_id = %connector_id,
            state = "error",
            duration_ms = duration_ms,
            event_type = %event_type,
            span_attrs = ?attrs,
            "webhook.receive span (error)"
        );
    }

    result
}

/// Extract event kind from provider-specific headers.
fn extract_event_kind(connector_id: &str, headers: &HashMap<String, String>) -> String {
    match connector_id {
        "github" => headers
            .get("x-github-event")
            .cloned()
            .unwrap_or_else(|| "push".to_string()),
        "canvas" => headers
            .get("x-canvas-event")
            .cloned()
            .unwrap_or_else(|| "message".to_string()),
        "gcal" => headers
            .get("x-goog-resource-state")
            .cloned()
            .unwrap_or_else(|| "sync_events".to_string()),
        _ => "unknown".to_string(),
    }
}

// ---------------------------------------------------------------------------
// Per-provider handler implementations
// ---------------------------------------------------------------------------

/// GitHub webhook handler with HMAC verification.
pub struct GitHubHandlerImpl {
    pub account_id: Uuid,
    pub verifier: Arc<GitHubHmacVerifier>,
}

#[async_trait]
impl WebhookHandler for GitHubHandlerImpl {
    async fn handle(&self, delivery: &WebhookDelivery) -> Result<Vec<NormalizedEvent>> {
        // Verify signature
        self.verifier
            .verify(&delivery.headers, &delivery.body)
            .await
            .map_err(|_e| ConnectorError::Forbidden("invalid github hmac".to_string()))?;

        // Delegate to GitHub handler
        let handler = GitHubWebhookHandler {
            account_id: self.account_id,
        };
        handler.handle(delivery).await
    }
}

/// Canvas webhook handler with JWT verification (stub).
pub struct CanvasHandlerImpl {
    #[allow(dead_code)]
    pub account_id: Uuid,
    pub verifier: Arc<CanvasLtiVerifier>,
}

#[async_trait]
impl WebhookHandler for CanvasHandlerImpl {
    async fn handle(&self, delivery: &WebhookDelivery) -> Result<Vec<NormalizedEvent>> {
        // Verify signature
        self.verifier
            .verify(&delivery.headers, &delivery.body)
            .await
            .map_err(|_e| ConnectorError::Forbidden("invalid canvas jwt".to_string()))?;

        // TODO: map Canvas event payload to NormalizedEvents
        Ok(vec![])
    }
}

/// Google Calendar webhook handler with channel token verification (stub).
pub struct GCalHandlerImpl {
    #[allow(dead_code)]
    pub account_id: Uuid,
    pub verifier: Arc<GCalChannelVerifier>,
}

#[async_trait]
impl WebhookHandler for GCalHandlerImpl {
    async fn handle(&self, delivery: &WebhookDelivery) -> Result<Vec<NormalizedEvent>> {
        // Verify signature
        self.verifier
            .verify(&delivery.headers, &delivery.body)
            .await
            .map_err(|_e| ConnectorError::Forbidden("invalid gcal channel token".to_string()))?;

        // TODO: map GCal event payload to NormalizedEvents
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use secrecy::ExposeSecret;

    #[tokio::test]
    async fn test_github_handler_verifies_signature() {
        let account_id = Uuid::new_v4();
        let secret = secrecy::SecretString::new("test-secret".to_string().into_boxed_str());
        let verifier = Arc::new(GitHubHmacVerifier {
            secret: secret.clone(),
        });

        let handler = GitHubHandlerImpl { account_id, verifier };

        // Create a valid HMAC signature
        use hmac::Mac;
        let body = b"test payload";
        let key = secret.expose_secret().as_bytes();
        let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(key).unwrap();
        mac.update(body);
        let digest = mac.finalize();
        let sig = format!("sha256={}", hex::encode(digest.into_bytes()));

        let mut headers = HashMap::new();
        headers.insert("x-hub-signature-256".to_string(), sig);

        let delivery = WebhookDelivery {
            connector_id: "github".to_string(),
            kind: "push".to_string(),
            headers,
            body: body.to_vec(),
            received_at: chrono::Utc::now(),
        };

        // Should succeed (JSON parse will fail, but signature verification passes)
        let result = handler.handle(&delivery).await;
        // We expect JSON parse error, not signature error
        assert!(matches!(result, Err(ConnectorError::Schema(_))));
    }

    #[test]
    fn test_extract_event_kind_github() {
        let mut headers = HashMap::new();
        headers.insert("x-github-event".to_string(), "pull_request".to_string());
        assert_eq!(super::extract_event_kind("github", &headers), "pull_request");
    }

    #[test]
    fn test_extract_event_kind_github_default() {
        let headers = HashMap::new();
        assert_eq!(super::extract_event_kind("github", &headers), "push");
    }

    #[test]
    fn test_extract_event_kind_canvas() {
        let mut headers = HashMap::new();
        headers.insert("x-canvas-event".to_string(), "assignment_submission".to_string());
        assert_eq!(super::extract_event_kind("canvas", &headers), "assignment_submission");
    }

    #[test]
    fn test_extract_event_kind_gcal() {
        let mut headers = HashMap::new();
        headers.insert("x-goog-resource-state".to_string(), "exists".to_string());
        assert_eq!(super::extract_event_kind("gcal", &headers), "exists");
    }
}
