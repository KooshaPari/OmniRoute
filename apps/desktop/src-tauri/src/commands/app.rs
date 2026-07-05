use serde::Serialize;
use tauri::Manager;
use crate::error::AppResult;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub identifier: String,
}

#[tauri::command]
pub async fn get_app_info(app: tauri::AppHandle) -> AppResult<AppInfo> {
    let version = app.package_info().version.to_string();
    Ok(AppInfo {
        name: "OmniRoute".to_string(),
        version,
        identifier: "online.phenotype.omniroute".to_string(),
    })
}

#[tauri::command]
pub async fn get_version(app: tauri::AppHandle) -> AppResult<String> {
    Ok(app.package_info().version.to_string())
}

#[tauri::command]
pub async fn quit(app: tauri::AppHandle) -> AppResult<()> {
    app.exit(0);
    Ok(())
}
