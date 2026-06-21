// SPDX-License-Identifier: MIT OR Apache-2.0

//! WebSocket transport for MCP server.
//!
//! Full-duplex JSON-RPC 2.0 session at ws://127.0.0.1:8474/mcp/ws
//! Bearer token required via initial auth message.
//! Rate limit: 100 req/min per connection.

use crate::tools::FocalPointToolsImpl;
use anyhow::Result;
use serde_json::{json, Value};
use std::time::Instant;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::info;
use futures::stream::StreamExt;
use futures::SinkExt;

const RATE_LIMIT_REQ_PER_MIN: f32 = 100.0;

/// WebSocket session state.
struct WsSession {
    authenticated: bool,
    rate_limiter: TokenBucket,
}

#[derive(Debug, Clone)]
struct TokenBucket {
    tokens: f32,
    last_refill: Instant,
}

impl TokenBucket {
    fn new() -> Self {
        Self {
            tokens: RATE_LIMIT_REQ_PER_MIN,
            last_refill: Instant::now(),
        }
    }

    fn check(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f32();
        let refill_rate = RATE_LIMIT_REQ_PER_MIN / 60.0;
        self.tokens = (self.tokens + elapsed * refill_rate).min(RATE_LIMIT_REQ_PER_MIN);
        self.last_refill = now;

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Start WebSocket server on configured bind address.
pub async fn start_websocket(_db_path: std::path::PathBuf, _tools_impl: FocalPointToolsImpl) -> Result<()> {
    let expected_token = std::env::var("FOCALPOINT_MCP_HTTP_TOKEN")
        .unwrap_or_else(|_| "focalpoint-default-insecure-token".to_string());

    let bind_addr = std::env::var("FOCALPOINT_MCP_WS_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:8474".to_string());

    let listener = TcpListener::bind(&bind_addr).await?;
    info!("WebSocket server listening on ws://{}/mcp/ws", bind_addr);

    let token = std::sync::Arc::new(expected_token);

    loop {
        let (stream, addr) = listener.accept().await?;
        let token = token.clone();

        tokio::spawn(async move {
            if let Err(e) = handle_ws_connection(stream, addr, token.as_ref()).await {
                tracing::warn!("WebSocket error from {}: {}", addr, e);
            }
        });
    }
}

async fn handle_ws_connection(
    stream: tokio::net::TcpStream,
    addr: std::net::SocketAddr,
    expected_token: &str,
) -> Result<()> {
    let ws = accept_async(stream).await?;
    let (mut tx, mut rx) = ws.split();
    let mut session = WsSession {
        authenticated: false,
        rate_limiter: TokenBucket::new(),
    };

    info!("WebSocket connection from {}", addr);

    while let Some(msg) = rx.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("WebSocket error from {}: {}", addr, e);
                break;
            }
        };

        if msg.is_close() {
            break;
        }

        if !msg.is_text() {
            continue;
        }

        let text = msg.to_text().ok();
        let request: Value = match text.and_then(|t| serde_json::from_str(t).ok()) {
            Some(v) => v,
            None => {
                let error = json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32700, "message": "Parse error" },
                    "id": Value::Null
                });
                let msg = Message::text(error.to_string());
                let _ = tx.send(msg).await;
                continue;
            }
        };

        // Handle auth before rate limiting
        if !session.authenticated {
            if let Some(token) = request.get("token").and_then(|v| v.as_str()) {
                if token == expected_token {
                    session.authenticated = true;
                    let response = json!({
                        "jsonrpc": "2.0",
                        "result": { "status": "authenticated" },
                        "id": request.get("id").cloned().unwrap_or(Value::Null)
                    });
                    let msg = Message::text(response.to_string());
                    let _ = tx.send(msg).await;
                    continue;
                } else {
                    let error = json!({
                        "jsonrpc": "2.0",
                        "error": { "code": -32603, "message": "Invalid token" },
                        "id": request.get("id").cloned().unwrap_or(Value::Null)
                    });
                    let msg = Message::text(error.to_string());
                    let _ = tx.send(msg).await;
                    continue;
                }
            } else {
                let error = json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32003, "message": "Authentication required" },
                    "id": request.get("id").cloned().unwrap_or(Value::Null)
                });
                let msg = Message::text(error.to_string());
                let _ = tx.send(msg).await;
                continue;
            }
        }

        // Rate limit check
        if !session.rate_limiter.check() {
            let error = json!({
                "jsonrpc": "2.0",
                "error": { "code": -32000, "message": "Rate limit exceeded: 100 req/min" },
                "id": request.get("id").cloned().unwrap_or(Value::Null)
            });
            let msg = Message::text(error.to_string());
            let _ = tx.send(msg).await;
            continue;
        }

        // Process tool invocation request
        let method = request.get("method").and_then(|v| v.as_str());
        let id = request.get("id").cloned().unwrap_or(Value::Null);

        let result = match method {
            Some("focalpoint.tasks.list") => json!({ "tasks": [], "status": "ok" }),
            Some("focalpoint.rules.list") => json!({ "rules": [], "status": "ok" }),
            Some("focalpoint.wallet.balance") => json!({ "balance": 0, "currency": "focus", "status": "ok" }),
            Some(tool) => json!({
                "error": format!("Unknown tool: {}", tool)
            }),
            None => json!({
                "error": "Missing method"
            }),
        };

        let response = json!({
            "jsonrpc": "2.0",
            "result": result,
            "id": id
        });

        let msg = Message::text(response.to_string());
        if let Err(e) = tx.send(msg).await {
            tracing::warn!("Failed to send WebSocket message: {}", e);
            break;
        }
    }

    info!("WebSocket connection closed: {}", addr);
    Ok(())
}
