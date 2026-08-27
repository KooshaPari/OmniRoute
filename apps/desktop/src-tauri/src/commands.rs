use std::{net::TcpStream, sync::Mutex, time::Duration};
use tauri::State;
use crate::lifecycle::{RuntimeState, RuntimeStatus};

pub struct AppState { pub runtime: Mutex<RuntimeStatus> }
impl Default for AppState { fn default() -> Self { Self { runtime: Mutex::new(RuntimeStatus::stopped(runtime_origin())) } } }
fn runtime_origin() -> String { std::env::var("OMNIROUTE_RUNTIME_ORIGIN").unwrap_or_else(|_| "http://localhost:20128".into()) }
fn runtime_addr(origin: &str) -> Result<std::net::SocketAddr, String> {
    let host = origin.strip_prefix("http://").or_else(|| origin.strip_prefix("https://")).unwrap_or(origin);
    host.parse().map_err(|_| "invalid runtime origin".to_string())
}

#[tauri::command]
pub fn runtime_start(state: State<'_, AppState>) -> Result<RuntimeStatus, String> {
    let mut runtime = state.runtime.lock().map_err(|_| "runtime state lock poisoned".to_string())?;
    if runtime.state == RuntimeState::Running { return Ok(runtime.clone()); }
    runtime.state = RuntimeState::Starting;
    runtime.state = if TcpStream::connect_timeout(&runtime_addr(&runtime.origin)?, Duration::from_millis(150)).is_ok() { RuntimeState::Running } else { RuntimeState::Stopped };
    Ok(runtime.clone())
}

#[tauri::command]
pub fn runtime_stop(state: State<'_, AppState>) -> Result<RuntimeStatus, String> { let mut runtime = state.runtime.lock().map_err(|_| "runtime state lock poisoned".to_string())?; runtime.state = RuntimeState::Stopped; Ok(runtime.clone()) }
#[tauri::command]
pub fn runtime_readiness(state: State<'_, AppState>) -> Result<RuntimeStatus, String> { state.runtime.lock().map(|runtime| runtime.clone()).map_err(|_| "runtime state lock poisoned".to_string()) }
#[tauri::command]
pub fn runtime_data_dir() -> Result<String, String> { std::env::var("OMNIROUTE_DATA_DIR").or_else(|_| std::env::var("HOME").map(|home| format!("{home}/.omniroute"))).map_err(|_| "home directory unavailable".to_string()) }
#[tauri::command]
pub fn dashboard_origin(state: State<'_, AppState>) -> Result<String, String> { state.runtime.lock().map(|runtime| runtime.origin.clone()).map_err(|_| "runtime state lock poisoned".to_string()) }
