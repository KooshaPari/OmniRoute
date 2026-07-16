use tauri::State;
use crate::error::AppResult;
use crate::gateway::GatewayProcess;
use crate::commands::types::GatewayStatus;

#[tauri::command]
pub async fn start_gateway(gw: State<'_, GatewayProcess>) -> AppResult<GatewayStatus> {
    gw.start().await?;
    let state = gw.state().await;
    Ok(GatewayStatus { state: format!("{:?}", state), healthy: gw.health_check().await })
}

#[tauri::command]
pub async fn stop_gateway(gw: State<'_, GatewayProcess>) -> AppResult<()> {
    gw.stop().await
}

#[tauri::command]
pub async fn gateway_status(gw: State<'_, GatewayProcess>) -> AppResult<GatewayStatus> {
    let state = gw.state().await;
    Ok(GatewayStatus { state: format!("{:?}", state), healthy: gw.health_check().await })
}
