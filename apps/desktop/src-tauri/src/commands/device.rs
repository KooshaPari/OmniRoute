use tauri::Manager;
use crate::error::AppResult;

#[tauri::command]
pub async fn get_device_id(app: tauri::AppHandle) -> AppResult<String> {
    use tauri_plugin_os::OsExt;
    let os = app.os();
    let host = os.hostname().unwrap_or_else(|_| "unknown".to_string());
    Ok(format!("{}-{}", host, std::process::id()))
}
