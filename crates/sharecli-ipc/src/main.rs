//! sharecli-ipc — JSON-RPC server
//!
//! Unix: listens on Unix socket `~/.local/share/sharecli/ipc.sock`
//! Windows: listens on TCP loopback `127.0.0.1:27182`
//! (or override via SHARECLI_IPC_SOCK or SHARECLI_IPC_ADDR env vars)
//!
//! Protocol: newline-delimited JSON (NDJSON).
//! Request:  `{"id": N, "method": "...", "params": {...}}`
//! Response: `{"id": N, "result": ..., "error": null}` or `{"id": N, "result": null, "error": "..."}`

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{error, info};

mod handler;

pub use handler::Handler;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    // Shared handler (holds ProcessPool + config)
    let handler = Arc::new(Handler::new().await?);

    #[cfg(unix)]
    {
        let sock_path = socket_path();

        // Remove stale socket from prior run
        if sock_path.exists() {
            std::fs::remove_file(&sock_path)?;
        }

        if let Some(parent) = sock_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let listener = tokio::net::UnixListener::bind(&sock_path)?;
        info!("sharecli-ipc listening on {}", sock_path.display());

        loop {
            let (stream, _) = listener.accept().await?;
            let h = handler.clone();
            tokio::spawn(async move {
                if let Err(e) = serve_unix_connection(stream, h).await {
                    error!("connection error: {e}");
                }
            });
        }
    }

    #[cfg(windows)]
    {
        let addr = ipc_addr();
        let listener = tokio::net::TcpListener::bind(&addr).await?;
        info!("sharecli-ipc listening on {}", addr);

        loop {
            let (stream, _) = listener.accept().await?;
            let h = handler.clone();
            tokio::spawn(async move {
                if let Err(e) = serve_tcp_connection(stream, h).await {
                    error!("connection error: {e}");
                }
            });
        }
    }
}

async fn serve_unix_connection(
    stream: tokio::net::UnixStream,
    handler: Arc<Handler>,
) -> Result<()> {
    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();

    while let Some(line) = lines.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = handler.dispatch(trimmed).await;
        let mut payload = serde_json::to_string(&response)?;
        payload.push('\n');
        writer.write_all(payload.as_bytes()).await?;
    }

    Ok(())
}

async fn serve_tcp_connection(stream: tokio::net::TcpStream, handler: Arc<Handler>) -> Result<()> {
    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();

    while let Some(line) = lines.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = handler.dispatch(trimmed).await;
        let mut payload = serde_json::to_string(&response)?;
        payload.push('\n');
        writer.write_all(payload.as_bytes()).await?;
    }

    Ok(())
}

pub fn socket_path() -> PathBuf {
    if let Ok(v) = std::env::var("SHARECLI_IPC_SOCK") {
        return PathBuf::from(v);
    }
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    base.join("sharecli").join("ipc.sock")
}

pub fn ipc_addr() -> String {
    std::env::var("SHARECLI_IPC_ADDR").unwrap_or_else(|_| "127.0.0.1:27182".to_string())
}
