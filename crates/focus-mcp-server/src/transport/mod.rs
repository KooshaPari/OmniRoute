// SPDX-License-Identifier: MIT OR Apache-2.0

//! MCP transport layer: STDIO (default), HTTP/SSE, and WebSocket.

#[cfg(feature = "http-sse")]
pub mod http_sse;

#[cfg(feature = "websocket")]
pub mod websocket;
