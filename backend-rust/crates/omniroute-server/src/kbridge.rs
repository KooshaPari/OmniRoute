//! kbridge: BFF <-> Rust gateway daemon over Unix domain socket + MessagePack-RPC.
//! Wire-format: 4-byte BE length-prefix + msgpack payload.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;
use omniroute_storage::call_logs::{insert as insert_call_log, CallLogRow};
use rmp_serde::Serializer;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{UnixListener, UnixStream};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Request {
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
pub enum Response {
    Ok { id: String, ok: bool, data: serde_json::Value },
    Err {
        id: String,
        ok: bool,
        error: ErrorBody,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
}

#[derive(Clone)]
pub struct KbridgeContext {
    pub pool: Option<Arc<SqlitePool>>,
}

impl KbridgeContext {
    pub fn new() -> Self { Self { pool: None } }
    pub fn with_pool(pool: Arc<SqlitePool>) -> Self { Self { pool: Some(pool) } }
}

pub async fn run(socket_path: PathBuf, ctx: KbridgeContext) -> anyhow::Result<()> {
    if socket_path.exists() {
        std::fs::remove_file(&socket_path).ok();
    }
    if let Some(parent) = socket_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let listener = UnixListener::bind(&socket_path)
        .with_context(|| format!("kbridge: bind {}", socket_path.display()))?;
    info!(path = %socket_path.display(), "kbridge: listening");

    let ctx = Arc::new(ctx);

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                let ctx = ctx.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_stream(stream, ctx).await {
                        warn!(error = %e, "kbridge: stream ended with error");
                    }
                });
            }
            Err(e) => {
                error!(error = %e, "kbridge: accept failed");
            }
        }
    }
}

async fn handle_stream(mut stream: UnixStream, ctx: Arc<KbridgeContext>) -> anyhow::Result<()> {
    let peer = stream.peer_addr().ok();
    debug!(?peer, "kbridge: client connected");

    loop {
        let mut len_buf = [0u8; 4];
        match stream.read_exact(&mut len_buf).await {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(()),
            Err(e) => return Err(e.into()),
        }
        let len = u32::from_be_bytes(len_buf) as usize;
        if len == 0 || len > 16 * 1024 * 1024 {
            warn!(len, "kbridge: frame too large or zero, closing");
            return Ok(());
        }

        let mut body = vec![0u8; len];
        stream.read_exact(&mut body).await?;
        let req: Request = match rmp_serde::from_slice(&body) {
            Ok(r) => r,
            Err(e) => {
                warn!(error = %e, "kbridge: decode failed");
                continue;
            }
        };

        let resp = handle_request(req, &ctx).await;
        let mut s = Serializer::new(Vec::new()).with_human_readable();
        resp.serialize(&mut s).context("kbridge: encode")?;
        let payload = s.into_inner();
        let frame_len = (payload.len() as u32).to_be_bytes();
        stream.write_all(&frame_len).await?;
        stream.write_all(&payload).await?;
        debug!(?peer, bytes = payload.len(), "kbridge: sent response");
    }
}

async fn handle_request(req: Request, ctx: &KbridgeContext) -> Response {
    let id = match &req {
        Request::Ping { id } => id.clone(),
        Request::Health { id } => id.clone(),
        Request::ComboResolve { id, .. } => id.clone(),
        Request::UsageRecord { id, .. } => id.clone(),
    };
    match req {
        Request::Ping { .. } => Response::Ok {
            id,
            ok: true,
            data: serde_json::json!({ "pong": true }),
        },
        Request::Health { .. } => {
            let uptime_s = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            Response::Ok {
                id,
                ok: true,
                data: serde_json::json!({ "status": "healthy", "uptime_s": uptime_s }),
            }
        }
        Request::ComboResolve { name, model, .. } => {
            info!(combo = %name, model = %model, "kbridge: combo.resolve (stub - trust model)");
            Response::Ok {
                id,
                ok: true,
                data: serde_json::json!({
                    "combo": name,
                    "resolved_model": model,
                    "strategy": "first-success",
                    "fallbacks": [],
                }),
            }
        }
        Request::UsageRecord { provider, model, tokens, cost, ts, .. } => {
            if let Some(pool) = &ctx.pool {
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(ts);
                let row = CallLogRow {
                    id: Uuid::new_v4().as_bytes().to_vec(),
                    request_id: format!("kbridge-{}", Uuid::new_v4()),
                    created_at: now_ms,
                    provider: provider.clone(),
                    model: model.clone(),
                    key_id: None,
                    status_code: 0,
                    error: None,
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: tokens as i32,
                    reasoning_tokens: None,
                    cached_tokens: None,
                    cost_micros: Some((cost * 1_000_000.0) as i64),
                    latency_ms: Some(0),
                    metadata: String::new(),
                    request_body: None,
                    response_body: None,
                };
                match insert_call_log(pool, &row).await {
                    Ok(id) => debug!(id, provider, model, tokens, cost, "kbridge: usage.record stored"),
                    Err(e) => warn!(error = %e, provider, model, "kbridge: usage.record storage error"),
                }
            } else {
                info!(provider, model, tokens, cost, "kbridge: usage.record (no pool, logged only)");
            }
            Response::Ok {
                id,
                ok: true,
                data: serde_json::json!({ "recorded": true }),
            }
        }
    }
}

pub fn spawn(socket_path: PathBuf, ctx: KbridgeContext) -> Arc<tokio::sync::Notify> {
    let stop = Arc::new(tokio::sync::Notify::new());
    let stop_clone = stop.clone();
    tokio::spawn(async move {
        if let Err(e) = run(socket_path, ctx).await {
            error!(error = %e, "kbridge listener exited");
        }
        stop_clone.notify_waiters();
    });
    stop
}
