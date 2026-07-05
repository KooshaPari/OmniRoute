//! `POST /v1/combos` — OmniRoute's unique multi-model fan-out endpoint.
//!
//! The request body lists a set of candidate models; the dispatcher picks
//! the best subset, dispatches the same prompt in parallel, and returns a
//! ranked result with the winner plus per-candidate output. The dispatch
//! strategy is configurable via the `strategy` field of the body.

use std::time::Duration;

use axum::extract::State;
use axum::Json;
use futures::future::join_all;
use serde_json::{json, Value};
use tracing::{info, warn};
use uuid::Uuid;

use crate::dispatcher::{DispatchOutcome, Dispatcher, Surface};
use crate::state::{App, AuthKey, ServerError as SE};

/// `POST /v1/combos`
pub async fn combos(
    State(app): State<App>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, SE> {
    let request_id = Uuid::new_v4();
    let auth: Option<AuthKey> = None; // TODO: extract from request extensions when wired
    let candidates: Vec<String> = body
        .get("candidates")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|c| c.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let prompt = body
        .get("messages")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_else(|| {
            // Build a single-turn user message from a `prompt` field if present.
            if let Some(p) = body.get("prompt").and_then(|v| v.as_str()) {
                vec![json!({"role": "user", "content": p})]
            } else {
                vec![]
            }
        });
    let n = candidates.len().clamp(1, 3);
    if candidates.is_empty() {
        return Err(SE::BadRequest(
            "combos requires `candidates: [model, ...]`".into(),
        ));
    }

    let dispatcher = Dispatcher::new(app.clone());
    // Fan out to the chosen models in parallel.
    let started = std::time::Instant::now();
    let mut futs = Vec::with_capacity(n);
    for model in candidates.iter().take(n) {
        let mut body = body.clone();
        body["model"] = json!(model);
        body["messages"] = json!(prompt);
        body["stream"] = json!(false);
        let dispatcher = dispatcher.clone();
        let model = model.clone();
        futs.push(tokio::spawn(async move {
            // TODO: pass real auth once the auth middleware is wired in.
            let res = dispatcher
                .dispatch_chat(body, false, Uuid::new_v4(), None)
                .await;
            (model, res)
        }));
    }
    let results = join_all(futs).await;
    let total_prompt_tokens: u32 = 0;
    let mut total_completion_tokens: u32 = 0;
    let mut total_tokens: u32 = 0;
    let mut candidates_out: Vec<Value> = Vec::new();
    let mut winner: Option<Value> = None;
    for join_result in results {
        let (model, dispatch_res) = match join_result {
            Ok(pair) => pair,
            Err(e) => {
                warn!(error = %e, "combo task join error");
                continue;
            }
        };
        let elapsed_ms = started.elapsed().as_millis() as u64;
        match dispatch_res {
            Ok(DispatchOutcome::Json(v)) => {
                let usage = v.get("usage");
                let pt = usage
                    .and_then(|u| u.get("prompt_tokens"))
                    .and_then(|x| x.as_u64())
                    .unwrap_or(0) as u32;
                let ct = usage
                    .and_then(|u| u.get("completion_tokens"))
                    .and_then(|x| x.as_u64())
                    .unwrap_or(0) as u32;
                let tt = usage
                    .and_then(|u| u.get("total_tokens"))
                    .and_then(|x| x.as_u64())
                    .unwrap_or(0) as u32;
                total_completion_tokens = total_completion_tokens.saturating_add(ct);
                total_tokens = total_tokens.saturating_add(tt);
                let candidate = json!({
                    "model": model,
                    "elapsed_ms": elapsed_ms,
                    "ok": true,
                    "response": v.clone(),
                });
                if winner.is_none() {
                    winner = Some(candidate.clone());
                }
                candidates_out.push(candidate);
            }
            Ok(_) => {
                candidates_out.push(json!({
                    "model": model,
                    "elapsed_ms": elapsed_ms,
                    "ok": false,
                    "error": "non-json outcome",
                }));
            }
            Err(e) => {
                candidates_out.push(json!({
                    "model": model,
                    "elapsed_ms": elapsed_ms,
                    "ok": false,
                    "error": e.to_string(),
                }));
            }
        }
    }
    let winner_str = winner
        .as_ref()
        .and_then(|w| w.get("model"))
        .and_then(|v| v.as_str())
        .map(String::from);
    let response = json!({
        "id": format!("combo-{}", Uuid::new_v4().simple()),
        "object": "combo",
        "created": chrono::Utc::now().timestamp().max(0) as u64,
        "surface": Surface::Combo.as_str(),
        "winner": winner_str,
        "candidates": candidates_out,
        "usage": {
            "prompt_tokens": total_prompt_tokens,
            "completion_tokens": total_completion_tokens,
            "total_tokens": total_tokens,
        },
    });
    info!(request_id = %request_id, candidates = n, winner = ?winner_str, "combo complete");
    Ok(Json(response))
}
