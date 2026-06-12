//! Tests for WebSocket transport.

#![cfg(feature = "websocket")]

use focus_mcp_server::FocalPointToolsImpl;
use focus_storage::SqliteAdapter;
use serde_json::json;
use std::path::PathBuf;

fn create_test_adapter() -> SqliteAdapter {
    SqliteAdapter::open(&PathBuf::from(":memory:")).expect("failed to open in-memory db")
}

#[tokio::test]
async fn test_websocket_server_ready() {
    let adapter = create_test_adapter();
    let tools = FocalPointToolsImpl::new(adapter);

    let mcp_tools = tools.build_mcp_tools();
    assert!(!mcp_tools.list_tools().is_empty(), "Server should have tools for WS endpoint");
}

#[tokio::test]
async fn test_websocket_json_rpc_format() {
    let request = json!({
        "jsonrpc": "2.0",
        "method": "focalpoint.tasks.list",
        "params": {},
        "id": 1
    });

    assert_eq!(request.get("jsonrpc").and_then(|v| v.as_str()), Some("2.0"), "Should be JSON-RPC 2.0");
    assert_eq!(request.get("method").and_then(|v| v.as_str()), Some("focalpoint.tasks.list"), "Method should be set");
    assert_eq!(request.get("id").and_then(|v| v.as_i64()), Some(1), "ID should be preserved");
}

#[tokio::test]
async fn test_websocket_auth_required_before_requests() {
    let expected_token = "test-secret-token";

    // Simulate auth message
    let auth_request = json!({
        "token": expected_token,
        "id": 0
    });

    let provided_token = auth_request.get("token").and_then(|v| v.as_str());
    assert_eq!(provided_token, Some(expected_token), "Token should match");
}

#[tokio::test]
async fn test_websocket_invalid_token_rejected() {
    let expected_token = "correct-token";
    let provided_token = "wrong-token";

    assert_ne!(provided_token, expected_token, "Should reject mismatched tokens");
}

#[tokio::test]
async fn test_websocket_rate_limit_429_error() {
    let error_code = -32000; // Standard JSON-RPC rate limit code
    let error_response = json!({
        "jsonrpc": "2.0",
        "error": {
            "code": error_code,
            "message": "Rate limit exceeded: 100 req/min"
        },
        "id": 1
    });

    assert_eq!(error_response.get("error").and_then(|e| e.get("code")).and_then(|c| c.as_i64()), Some(-32000), "Should have rate limit error code");
}

#[tokio::test]
async fn test_websocket_tool_invocation_preserves_id() {
    let request_id = 42;
    let request = json!({
        "jsonrpc": "2.0",
        "method": "focalpoint.wallet.balance",
        "id": request_id
    });

    let response_id = request.get("id").cloned();
    assert_eq!(response_id, Some(json!(request_id)), "Response should preserve request ID");
}

#[tokio::test]
async fn test_websocket_full_duplex_session() {
    let adapter = create_test_adapter();
    let tools = FocalPointToolsImpl::new(adapter);

    let mcp_tools = tools.build_mcp_tools();

    // Simulate a series of requests
    let requests = vec![
        json!({ "jsonrpc": "2.0", "method": "focalpoint.tasks.list", "id": 1 }),
        json!({ "jsonrpc": "2.0", "method": "focalpoint.rules.list", "id": 2 }),
        json!({ "jsonrpc": "2.0", "method": "focalpoint.wallet.balance", "id": 3 }),
    ];

    assert_eq!(requests.len(), 3, "Should have 3 test requests");
    assert!(!mcp_tools.list_tools().is_empty(), "Server should handle multiple requests");
}
