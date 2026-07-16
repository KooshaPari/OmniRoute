use crate::error::AppResult;
use crate::commands::types::ProxySettings;

#[tauri::command]
pub async fn get_proxy_settings() -> AppResult<ProxySettings> {
    Ok(ProxySettings {
        enabled: false,
        upstream: std::env::var("OMNIROUTE_UPSTREAM").unwrap_or_else(|_| "http://localhost:20128".to_string()),
        port: 20128,
    })
}
