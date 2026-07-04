//! `sharecli serve` -- lock-guarded HTTP + WebSocket dashboard server.
//!
//! GET  /healthz  -- liveness probe (JSON)
//! WS   /ws       -- streams periodic ProcessSummary snapshots as JSON

use crate::serve_lock::{decide, probe, Decision, OnConflict, ServeState};
use anyhow::Result;
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use serde_json::json;

use crate::runtime::ProcessPool;

/// Entry point for `sharecli serve`.
pub async fn run(bind: &str, on_conflict: OnConflict) -> Result<()> {
    let state = probe("sharecli")?;

    match decide(&state, on_conflict) {
        Decision::Attach => {
            let url = match &state {
                ServeState::Running { info, .. } => info.url.clone(),
                ServeState::Free => unreachable!(),
            };
            println!("sharecli serve already running at {url}");
            return Ok(());
        }
        Decision::Abort => {
            let url = match &state {
                ServeState::Running { info, .. } => info.url.clone(),
                ServeState::Free => unreachable!(),
            };
            anyhow::bail!("serve already running at {url}");
        }
        Decision::Serve | Decision::Replace => {}
    }

    let url = format!("http://{bind}");
    let lock =
        crate::serve_lock::ServeLock::try_acquire("sharecli", url.clone())?.ok_or_else(|| {
            anyhow::anyhow!("could not acquire serve lock -- another instance is running")
        })?;

    println!("sharecli serve listening on {url}");

    let app = Router::new().route("/healthz", get(healthz)).route("/ws", get(ws_handler));

    let listener = tokio::net::TcpListener::bind(bind).await?;

    tokio::select! {
        result = axum::serve(listener, app) => {
            result?;
        }
        _ = tokio::signal::ctrl_c() => {
            println!("sharecli serve shutting down");
        }
    }

    // Explicit drop for clarity; drop order would handle it anyway.
    drop(lock);
    Ok(())
}

async fn healthz() -> impl IntoResponse {
    Json(json!({"status": "ok"}))
}

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_ws)
}

async fn handle_ws(mut socket: WebSocket) {
    loop {
        let snapshot = build_snapshot().await;
        let msg = match serde_json::to_string(&snapshot) {
            Ok(s) => Message::Text(s.into()),
            Err(e) => {
                tracing::warn!("ws serialize error: {e}");
                break;
            }
        };

        if socket.send(msg).await.is_err() {
            break; // client disconnected
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }
}

async fn build_snapshot() -> serde_json::Value {
    let pool = ProcessPool::new();
    let procs = pool.list().await;
    let summaries: Vec<_> = procs
        .iter()
        .map(|p| {
            json!({
                "pid": p.pid,
                "name": p.name,
                "cmd": p.cmd,
                "memory_mb": p.memory_mb,
                "project": p.project,
                "harness": p.harness,
                "start_time": p.start_time,
            })
        })
        .collect();

    json!({ "processes": summaries })
}

#[cfg(test)]
mod tests {
    use crate::serve_lock::{decide, Decision, OnConflict, ServeInfo, ServeState};

    fn running_live(url: &str) -> ServeState {
        ServeState::Running {
            info: ServeInfo {
                pid: std::process::id(),
                service: "sharecli".into(),
                url: url.into(),
                started_at_unix: 1,
            },
            stale: false,
        }
    }

    fn running_stale() -> ServeState {
        ServeState::Running {
            info: ServeInfo {
                pid: u32::MAX,
                service: "sharecli".into(),
                url: "http://127.0.0.1:9000".into(),
                started_at_unix: 1,
            },
            stale: true,
        }
    }

    #[test]
    fn free_state_always_serves() {
        assert_eq!(decide(&ServeState::Free, OnConflict::Abort), Decision::Serve);
        assert_eq!(decide(&ServeState::Free, OnConflict::Attach), Decision::Serve);
        assert_eq!(decide(&ServeState::Free, OnConflict::Replace), Decision::Serve);
        assert_eq!(decide(&ServeState::Free, OnConflict::Prompt), Decision::Serve);
    }

    #[test]
    fn stale_running_serves_regardless_of_policy() {
        let stale = running_stale();
        assert_eq!(decide(&stale, OnConflict::Abort), Decision::Serve);
        assert_eq!(decide(&stale, OnConflict::Attach), Decision::Serve);
    }

    #[test]
    fn live_running_abort_policy_aborts() {
        let live = running_live("http://127.0.0.1:9000");
        assert_eq!(decide(&live, OnConflict::Abort), Decision::Abort);
        assert_eq!(decide(&live, OnConflict::Prompt), Decision::Abort);
    }

    #[test]
    fn live_running_attach_policy_attaches() {
        let live = running_live("http://127.0.0.1:9000");
        assert_eq!(decide(&live, OnConflict::Attach), Decision::Attach);
    }

    #[test]
    fn live_running_replace_policy_replaces() {
        let live = running_live("http://127.0.0.1:9000");
        assert_eq!(decide(&live, OnConflict::Replace), Decision::Replace);
    }
}
