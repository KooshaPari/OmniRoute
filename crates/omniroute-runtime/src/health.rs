//! `/healthz` and `/readyz` handlers.

use std::sync::Arc;

use hyper::body::Bytes;
use hyper::Response;

use omniroute_core::ProviderRegistry;
use crate::ResponseBody;

/// `GET /healthz` — always returns `200 OK` with the build version if the
/// process is alive. No external calls; safe to hit from a liveness probe.
pub fn healthz(version: &str) -> Response<ResponseBody> {
    Response::builder()
        .status(200)
        .header("content-type", "text/plain; charset=utf-8")
        .header("x-omniroute-version", version)
        .body(ResponseBody::new(Bytes::from(format!("ok {version}"))))
        .expect("static response")
}

/// `GET /readyz` — returns `200 OK` if at least one provider is registered
/// AND every registered provider answers `ping()`. Returns `503` with a
/// JSON list of failed providers otherwise.
pub async fn readyz(
    registry: &Arc<ProviderRegistry>,
) -> Response<ResponseBody> {
    let ids = registry.ids();
    if ids.is_empty() {
        return json_status(
            503,
            &serde_json::json!({
                "status": "not_ready",
                "reason": "no providers registered",
            }),
        );
    }

    let mut failed: Vec<String> = Vec::new();
    for id in &ids {
        let Some(provider) = registry.get(id) else {
            failed.push(id.clone());
            continue;
        };
        let ctx = omniroute_core::Context::new(
            omniroute_core::Credentials::none(),
            id.clone(),
            format!("readyz-{}", uuid::Uuid::new_v4()),
        );
        if provider.ping(&ctx).await.is_err() {
            failed.push(id.clone());
        }
    }

    if failed.is_empty() {
        json_status(
            200,
            &serde_json::json!({
                "status": "ready",
                "providers": ids,
            }),
        )
    } else {
        json_status(
            503,
            &serde_json::json!({
                "status": "not_ready",
                "failed": failed,
                "ok": ids.iter().filter(|i| !failed.contains(i)).collect::<Vec<_>>(),
            }),
        )
    }
}

fn json_status(status: u16, body: &serde_json::Value) -> Response<ResponseBody> {
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(ResponseBody::new(Bytes::from(body.to_string())))
        .expect("static response")
}