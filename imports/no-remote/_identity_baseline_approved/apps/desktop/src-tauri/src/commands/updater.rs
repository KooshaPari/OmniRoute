use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use serde::Serialize;
use crate::error::{AppError, AppResult};

#[derive(Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> AppResult<UpdateInfo> {
    let current = app.package_info().version.to_string();
    let updater = app.updater().map_err(|e| AppError::Internal(e.to_string()))?;
    match updater.check().await {
        Ok(Some(_)) => Ok(UpdateInfo { available: true, current_version: current, latest_version: None }),
        Ok(None) => Ok(UpdateInfo { available: false, current_version: current, latest_version: None }),
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}
