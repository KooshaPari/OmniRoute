//! OpenAPI + response-shape contract test.

use std::sync::Arc;

use omniroute_core::{ChatMessage, ChatRequest};
use omniroute_providers::Registry;
use omniroute_transport::{router, AppState};

async fn spawn_server() -> std::net::SocketAddr {
    let state = AppState { registry: Arc::new(Registry::default()), http: reqwest::Client::new() };
    let app = router(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    addr
}

#[tokio::test]
async fn health_endpoint_returns_ok() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .get(format!("http://{}/health", addr))
        .send().await.unwrap();
    assert_eq!(res.status(), 200);
    let body = res.text().await.unwrap();
    assert_eq!(body, "ok");
}

#[tokio::test]
async fn openapi_json_includes_chat_completions_path() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .get(format!("http://{}/openapi.json", addr))
        .send().await.unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body["openapi"], "3.1.0");
    assert!(body["paths"]["/v1/chat/completions"].is_object());
    assert!(body["paths"]["/v1/chat/completions"]["post"].is_object());
}

#[tokio::test]
async fn chat_completions_with_no_provider_returns_503() {
    let addr = spawn_server().await;
    let req = ChatRequest {
        model: "gpt-4o".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "hi".to_string() }],
        temperature: None,
        max_tokens: None,
        stream: false,
    };
    let res = reqwest::Client::new()
        .post(format!("http://{}/v1/chat/completions", addr))
        .json(&req)
        .send().await.unwrap();
    assert_eq!(res.status(), 503);
}

#[test]
fn chat_request_response_shape_matches_openai() {
    let req = ChatRequest {
        model: "gpt-4o".to_string(),
        messages: vec![
            ChatMessage { role: "system".to_string(), content: "You are helpful.".to_string() },
            ChatMessage { role: "user".to_string(), content: "Hello.".to_string() },
        ],
        temperature: Some(0.7),
        max_tokens: Some(64),
        stream: false,
    };
    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("\"model\":\"gpt-4o\""));
    assert!(json.contains("\"role\":\"user\""));
    assert!(json.contains("\"temperature\":0.7"));
    assert!(json.contains("\"max_tokens\":64"));
}


// =====================================================================
// WP-RS-3: /v1/tokn/* HTTP surface contract tests.
// These tests pin the wire format of the tokn HTTP endpoints. The same
// Rust combo resolver backs both the FFI (crates/tokn-ffi) and these
// endpoints, so a decision made via FFI matches one made via HTTP byte
// for byte (modulo JSON field ordering).
// =====================================================================

#[tokio::test]
async fn tokn_decide_returns_openai_for_gpt4o() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .post(format!("http://{}/v1/tokn/decide", addr))
        .json(&serde_json::json!({"model": "gpt-4o"}))
        .send().await.unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body["provider"], "openai");
    assert_eq!(body["model"], "gpt-4o");
    assert_eq!(body["source"], "native");
    let chain = body["fallbackChain"].as_array().unwrap();
    assert!(!chain.is_empty());
    assert!(chain.iter().any(|v| v == "openrouter"));
}

#[tokio::test]
async fn tokn_decide_handles_camel_case_tenant_id() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .post(format!("http://{}/v1/tokn/decide", addr))
        .json(&serde_json::json!({"model": "claude-3-5-sonnet-latest", "tenantId": "tenant-x"}))
        .send().await.unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body["provider"], "anthropic");
}

#[tokio::test]
async fn tokn_decide_rejects_empty_model_with_400() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .post(format!("http://{}/v1/tokn/decide", addr))
        .json(&serde_json::json!({"model": "   "}))
        .send().await.unwrap();
    assert_eq!(res.status(), 400);
    let body: serde_json::Value = res.json().await.unwrap();
    assert!(body["error"].is_string());
}

#[tokio::test]
async fn tokn_decide_unknown_model_returns_openrouter_default() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .post(format!("http://{}/v1/tokn/decide", addr))
        .json(&serde_json::json!({"model": "no-such-model"}))
        .send().await.unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body["provider"], "openrouter");
    assert_eq!(body["fallbackChain"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn tokn_stats_reports_native_impl() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .get(format!("http://{}/v1/tokn/stats", addr))
        .send().await.unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body["implKind"], "native");
    assert_eq!(body["healthy"], true);
    assert_eq!(body["transport"], "rust-axum");
    assert!(body["version"].is_string());
}

#[tokio::test]
async fn openapi_documents_tokn_endpoints() {
    let addr = spawn_server().await;
    let res = reqwest::Client::new()
        .get(format!("http://{}/openapi.json", addr))
        .send().await.unwrap();
    let body: serde_json::Value = res.json().await.unwrap();
    assert!(body["paths"]["/v1/tokn/decide"]["post"].is_object());
    assert!(body["paths"]["/v1/tokn/stats"]["get"].is_object());
    assert!(body["components"]["schemas"]["ToknDecideRequest"].is_object());
    assert!(body["components"]["schemas"]["ToknDecideResponse"].is_object());
    assert!(body["components"]["schemas"]["ToknStatsResponse"].is_object());
}
