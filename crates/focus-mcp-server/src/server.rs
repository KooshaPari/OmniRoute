// SPDX-License-Identifier: MIT OR Apache-2.0

//! MCP server transport layer: STDIO (default).

use crate::tools::FocalPointToolsImpl;
use anyhow::Result;
use mcp_sdk::server::Server;
use mcp_sdk::transport::{Transport, ServerStdioTransport};
use tracing::info;

/// Run the MCP server over STDIO transport (default).
pub async fn run_stdio(tools_impl: FocalPointToolsImpl) -> Result<()> {
    info!("Starting FocalPoint MCP server (STDIO)");

    // Create STDIO transport
    let transport = ServerStdioTransport;
    transport.open()?;

    // Build the MCP server with tools
    let server = Server::builder(transport)
        .name("focalpoint-mcp-server")
        .version(env!("CARGO_PKG_VERSION"))
        .tools(tools_impl.build_mcp_tools())
        .build();

    // Run the server (listen for incoming requests)
    server.listen().await?;

    Ok(())
}
