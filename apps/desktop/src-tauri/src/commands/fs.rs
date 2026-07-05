use std::path::PathBuf;
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn read_file(path: String) -> AppResult<String> {
    tokio::fs::read_to_string(PathBuf::from(path))
        .await
        .map_err(|e| AppError::Io(e.to_string()))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> AppResult<()> {
    tokio::fs::write(PathBuf::from(path), content)
        .await
        .map_err(|e| AppError::Io(e.to_string()))
}
