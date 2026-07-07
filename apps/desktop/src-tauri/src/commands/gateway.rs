/**
 * Tauri command wrappers around the omniroute-gateway KbridgeClient.
 */
use std::sync::Arc;

use omniroute_gateway::{KbridgeClient, KbridgeRequest, KbridgeResponse};
use tauri::State;

#[tauri::command]
pub async fn ping_kbridge(client: State<'_, Arc<KbridgeClient>>) -> Result<serde_json::Value, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let reply = client.call(KbridgeRequest::Ping { id }).await.map_err(|e| e.to_string())?;
    Ok(match reply {
        KbridgeResponse::Ok { data, .. } => data,
        KbridgeResponse::Err { error, .. } => serde_json::json!({"kbridge_error": error}),
    })
}

#[tauri::command]
pub async fn health_kbridge(client: State<'_, Arc<KbridgeClient>>) -> Result<serde_json::Value, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let reply = client.call(KbridgeRequest::Health { id }).await.map_err(|e| e.to_string())?;
    Ok(match reply {
        KbridgeResponse::Ok { data, .. } => data,
        KbridgeResponse::Err { error, .. } => serde_json::json!({"kbridge_error": error}),
    })
}

#[tauri::command]
pub async fn combo_resolve(
    client: State<'_, Arc<KbridgeClient>>, name: String, model: String,
) -> Result<serde_json::Value, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let reply = client.call(KbridgeRequest::ComboResolve { id, name, model }).await.map_err(|e| e.to_string())?;
    Ok(match reply {
        KbridgeResponse::Ok { data, .. } => data,
        KbridgeResponse::Err { error, .. } => serde_json::json!({"kbridge_error": error}),
    })
}

#[tauri::command]
pub async fn usage_record(
    client: State<'_, Arc<KbridgeClient>>,
    provider: String, model: String, tokens: u64, cost: f64,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    let ts = chrono::Utc::now().timestamp();
    let reply = client.call(KbridgeRequest::UsageRecord { id, provider, model, tokens, cost, ts }).await.map_err(|e| e.to_string())?;
    match reply {
        KbridgeResponse::Ok { .. } => Ok(()),
        KbridgeResponse::Err { error, .. } => Err(format!("{}: {}", error.code, error.message)),
    }
}
