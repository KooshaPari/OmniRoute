//! Auth helpers. The auth model is intentionally simple: every request must
//! carry `Authorization: Bearer <key>` (or `x-api-key: <key>`) and the key
//! must hash to a row in `api_keys`. The hash is SHA-256 of the cleartext,
//! stored lowercase hex.
//!
//! For v1 we don't enforce scopes. Auth returns an `AuthKey` record that
//! handlers can use to attribute usage and isolate tenants.

use axum::extract::Request;
use axum::http::header::AUTHORIZATION;
use axum::middleware::Next;
use axum::response::Response;
use tracing::warn;

use omni_storage::ApiKeyStatus;

use crate::state::{sha256_hex, App, AuthKey, ServerError, ServerResult};

/// Pull the cleartext API key out of the request headers, if any.
pub fn extract_key(req: &Request) -> Option<String> {
    if let Some(v) = req.headers().get(AUTHORIZATION) {
        if let Ok(s) = v.to_str() {
            if let Some(rest) = s.strip_prefix("Bearer ") {
                return Some(rest.trim().to_string());
            }
            if let Some(rest) = s.strip_prefix("bearer ") {
                return Some(rest.trim().to_string());
            }
        }
    }
    if let Some(v) = req.headers().get("x-api-key") {
        if let Ok(s) = v.to_str() {
            return Some(s.trim().to_string());
        }
    }
    None
}

/// Resolve an API key to its stored record. Returns `Unauthorized` if the
/// key is missing, malformed, unknown, or revoked.
pub async fn authenticate(app: &App, cleartext: &str) -> ServerResult<AuthKey> {
    if cleartext.is_empty() || cleartext.len() < 8 {
        return Err(ServerError::Unauthorized);
    }
    let pool = app.pool.as_ref().ok_or(ServerError::Unauthorized)?;
    let hash = sha256_hex(cleartext);
    let repo = omni_storage::repo::api_key_repo(pool.pool());
    let key = repo
        .get_by_hash(&hash)
        .await?
        .ok_or(ServerError::Unauthorized)?;
    match key.status {
        ApiKeyStatus::Active => {}
        ApiKeyStatus::Revoked | ApiKeyStatus::Expired => {
            warn!(api_key_id = %key.id, "rejected revoked/expired key");
            return Err(ServerError::Unauthorized);
        }
    }
    // Touch last-used timestamp best-effort.
    let _ = repo.touch_last_used(key.id).await;
    Ok(AuthKey {
        id: key.id.0.simple().to_string(),
        tenant_id: key.tenant_id.0.simple().to_string(),
        workspace_id: key.workspace_id.0.simple().to_string(),
        label: key.label,
    })
}

/// Axum middleware that enforces auth when `app.config.require_auth` is true.
/// On success, the resolved `AuthKey` is stuffed into request extensions so
/// downstream handlers can pull it via `Extension<AuthKey>`.
pub async fn auth_middleware(app: App, mut req: Request, next: Next) -> Result<Response, ServerError> {
    if !app.config.require_auth {
        return Ok(next.run(req).await);
    }
    let cleartext = extract_key(&req).ok_or(ServerError::Unauthorized)?;
    let auth = authenticate(&app, &cleartext).await?;
    req.extensions_mut().insert(auth);
    Ok(next.run(req).await)
}
