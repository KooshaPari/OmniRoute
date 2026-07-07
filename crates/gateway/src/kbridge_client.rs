/**
 * kbridge Unix-socket + MessagePack-RPC client.
 * Mirrors apps/web/src/lib/server/hono/routes/kbridge.ts and the TS prototype
 * client at apps/bff/src/kbridge/client.ts.
 */
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;
use tracing::{debug, warn};

const MAX_FRAME: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum KbridgeRequest {
    Ping { id: String },
    Health { id: String },
    ComboResolve { id: String, name: String, model: String },
    UsageRecord {
        id: String,
        provider: String,
        model: String,
        tokens: u64,
        cost: f64,
        ts: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum KbridgeResponse {
    Ok {
        id: String,
        ok: bool,
        data: serde_json::Value,
    },
    Err {
        id: String,
        ok: bool,
        error: KbridgeError,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbridgeError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Error)]
pub enum KbridgeError_ {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("decode: {0}")]
    Decode(String),
    #[error("encode: {0}")]
    Encode(String),
    #[error("timeout after {0:?}")]
    Timeout(Duration),
    #[error("frame too large: {0}")]
    FrameTooLarge(usize),
}

#[derive(Clone)]
pub struct KbridgeClient {
    socket: PathBuf,
    timeout: Duration,
}

impl Default for KbridgeClient {
    fn default() -> Self {
        Self::new()
    }
}

impl KbridgeClient {
    pub fn new() -> Self {
        Self {
            socket: PathBuf::from("/var/run/omniroute/gateway.sock"),
            timeout: Duration::from_secs(10),
        }
    }

    pub fn with_socket(socket: PathBuf) -> Self {
        Self { socket, timeout: Duration::from_secs(10) }
    }

    pub async fn call(&self, req: KbridgeRequest) -> Result<KbridgeResponse, KbridgeError_> {
        let id = match &req {
            KbridgeRequest::Ping { id } => id.clone(),
            KbridgeRequest::Health { id } => id.clone(),
            KbridgeRequest::ComboResolve { id, .. } => id.clone(),
            KbridgeRequest::UsageRecord { id, .. } => id.clone(),
        };

        let mut stream = tokio::time::timeout(self.timeout, UnixStream::connect(&self.socket))
            .await
            .map_err(|_| KbridgeError_::Timeout(self.timeout))??;

        let body = rmp_serde::to_vec_named(&req).map_err(|e| KbridgeError_::Encode(e.to_string()))?;
        if body.len() + 4 > MAX_FRAME {
            return Err(KbridgeError_::FrameTooLarge(body.len()));
        }
        let len = (body.len() as u32).to_be_bytes();
        stream.write_all(&len).await?;
        stream.write_all(&body).await?;
        stream.flush().await?;

        let mut len_buf = [0u8; 4];
        tokio::time::timeout(self.timeout, stream.read_exact(&mut len_buf))
            .await
            .map_err(|_| KbridgeError_::Timeout(self.timeout))??;
        let len = u32::from_be_bytes(len_buf) as usize;
        if len == 0 || len > MAX_FRAME {
            warn!(len, "kbridge: frame size out of bounds");
            return Err(KbridgeError_::FrameTooLarge(len));
        }
        let mut body = vec![0u8; len];
        tokio::time::timeout(self.timeout, stream.read_exact(&mut body))
            .await
            .map_err(|_| KbridgeError_::Timeout(self.timeout))??;

        debug!(id, bytes = len, "kbridge: received");
        let resp: KbridgeResponse = rmp_serde::from_slice(&body)
            .map_err(|e| KbridgeError_::Decode(e.to_string()))?;
        Ok(resp)
    }
}
