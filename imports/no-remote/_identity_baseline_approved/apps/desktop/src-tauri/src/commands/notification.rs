use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use crate::error::AppResult;

#[tauri::command]
pub async fn notify(app: AppHandle, title: String, body: String) -> AppResult<()> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;
    Ok(())
}
