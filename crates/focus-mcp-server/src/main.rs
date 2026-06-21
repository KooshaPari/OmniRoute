// SPDX-License-Identifier: MIT OR Apache-2.0

//! MCP (Model Context Protocol) server exposing FocalPoint's rule/task/wallet/audit surface.
//!
//! Exposes 27 tools + resources for agent-driven planning, rule authoring, and diagnostics.
//! STDIO transport by default; optional HTTP/SSE and WebSocket transports.
//!
//! Usage:
//!   focalpoint-mcp-server [--mode stdio|http|ws] [--db <path>]
//!
//! Env:
//!   FOCALPOINT_DB — path to core.db (overrides --db flag and platform default)
//!   FOCALPOINT_MCP_HTTP_ADDR — bind address for HTTP/SSE (default 127.0.0.1:8473)
//!   FOCALPOINT_MCP_WS_ADDR — bind address for WebSocket (default 127.0.0.1:8474)
//!   FOCALPOINT_MCP_HTTP_TOKEN — bearer token for authentication (default: insecure-token)

mod server;
mod tools;
mod transport;

use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "focalpoint-mcp-server")]
#[command(about = "MCP server for FocalPoint: tasks, rules, wallet, audit, templates, connectors")]
struct Cli {
    /// Transport mode: stdio (default), http (HTTP/SSE), or ws (WebSocket).
    #[arg(long, value_name = "MODE", default_value = "stdio")]
    mode: String,

    /// Path to FocalPoint core.db. Defaults to FOCALPOINT_DB env var or platform default.
    #[arg(long)]
    db: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive(tracing_subscriber::filter::LevelFilter::INFO.into()),
        )
        .init();

    let cli = Cli::parse();

    let db_path = cli.db.or_else(|| {
        std::env::var("FOCALPOINT_DB")
            .ok()
            .map(PathBuf::from)
    }).or_else(|| {
        // Platform default: macOS Application Support
        #[cfg(target_os = "macos")]
        {
            let mut path = dirs::home_dir()?;
            path.push("Library/Application Support/focalpoint/core.db");
            Some(path)
        }
        #[cfg(not(target_os = "macos"))]
        {
            let mut path = dirs::data_local_dir()?;
            path.push("focalpoint/core.db");
            Some(path)
        }
    });

    if let Some(path) = &db_path {
        tracing::info!("Using database: {}", path.display());
    } else {
        anyhow::bail!("No database path found. Set --db or FOCALPOINT_DB.");
    }

    let db_path = db_path.unwrap();

    // Load database adapter
    let db_path_for_open = db_path.clone();
    let adapter = tokio::task::spawn_blocking(move || {
        focus_storage::SqliteAdapter::open(&db_path_for_open)
    })
    .await??;

    let tools_impl = crate::tools::FocalPointToolsImpl::new(adapter);

    // Route based on mode parameter
    match cli.mode.as_str() {
        "stdio" => {
            tracing::info!("Running MCP server in STDIO mode");
            server::run_stdio(tools_impl).await?;
        }
        #[cfg(feature = "http-sse")]
        "http" => {
            tracing::info!("Running MCP server in HTTP/SSE mode");
            transport::http_sse::start_http_sse(db_path, tools_impl).await?;
        }
        #[cfg(not(feature = "http-sse"))]
        "http" => {
            anyhow::bail!("HTTP/SSE mode requires feature 'http-sse'. Compile with: cargo build --features http-sse");
        }
        #[cfg(feature = "websocket")]
        "ws" => {
            tracing::info!("Running MCP server in WebSocket mode");
            transport::websocket::start_websocket(db_path, tools_impl).await?;
        }
        #[cfg(not(feature = "websocket"))]
        "ws" => {
            anyhow::bail!("WebSocket mode requires feature 'websocket'. Compile with: cargo build --features websocket");
        }
        _ => {
            anyhow::bail!("Invalid mode '{}'. Valid modes: stdio, http, ws", cli.mode);
        }
    }

    Ok(())
}
