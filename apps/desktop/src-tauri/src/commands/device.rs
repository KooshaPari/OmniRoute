use tauri::AppHandle;
use crate::error::AppResult;

#[tauri::command]
pub async fn get_device_id(_app: AppHandle) -> AppResult<String> {
    let host = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".to_string());
    Ok(format!("{}-{}", host, std::process::id()))
}
