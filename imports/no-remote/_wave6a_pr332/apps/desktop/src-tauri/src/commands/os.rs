use tauri::AppHandle;
use crate::error::AppResult;

#[tauri::command]
pub async fn get_platform(_app: AppHandle) -> AppResult<String> {
    Ok(std::env::consts::OS.to_string())
}

#[tauri::command]
pub async fn get_arch(_app: AppHandle) -> AppResult<String> {
    Ok(std::env::consts::ARCH.to_string())
}
