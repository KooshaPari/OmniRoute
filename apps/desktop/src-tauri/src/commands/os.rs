use tauri_plugin_os::OsExt;
use tauri::AppHandle;
use crate::error::AppResult;

#[tauri::command]
pub async fn get_platform(app: AppHandle) -> AppResult<String> {
    Ok(app.os().platform().to_string())
}

#[tauri::command]
pub async fn get_arch(app: AppHandle) -> AppResult<String> {
    Ok(app.os().arch().to_string())
}
