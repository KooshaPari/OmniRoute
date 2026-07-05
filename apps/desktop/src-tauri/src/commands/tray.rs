use tauri::{AppHandle, Manager};
use crate::error::AppResult;

#[tauri::command]
pub async fn show_tray(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_tray(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().ok();
    }
    Ok(())
}
