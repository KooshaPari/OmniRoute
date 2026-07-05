use tauri::AppHandle;
use tauri_plugin_fs::FsExt;
use crate::error::AppResult;

#[tauri::command]
pub async fn read_file(app: AppHandle, path: String) -> AppResult<String> {
    app.fs()
        .read_to_string(&path)
        .await
        .map_err(|e| crate::error::AppError::Io(e.to_string()))
}

#[tauri::command]
pub async fn write_file(app: AppHandle, path: String, content: String) -> AppResult<()> {
    app.fs()
        .write(&path, content)
        .await
        .map_err(|e| crate::error::AppError::Io(e.to_string()))
}
