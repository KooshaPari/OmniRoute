use std::sync::Arc;

use omniroute_gateway::GatewayProcess;
use tauri::State;

#[tauri::command]
pub async fn status(proc: State<'_, Arc<GatewayProcess>>) -> serde_json::Value {
    let s = proc.status();
    serde_json::to_value(&s).unwrap_or_default()
}

#[tauri::command]
pub async fn restart(proc: State<'_, Arc<GatewayProcess>>) -> Result<(), String> {
    let mut guard = proc.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut c) = guard.take() {
        let _ = c.kill().await;
    }
    drop(guard);
    proc.restart_count += 1;
    Ok(())
}
