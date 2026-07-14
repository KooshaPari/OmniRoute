use crate::error::AppResult;

#[tauri::command]
pub async fn install_cert() -> AppResult<()> {
    Ok(())
}
