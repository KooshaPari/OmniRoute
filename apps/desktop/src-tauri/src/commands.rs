use crate::lifecycle::{RuntimeState, RuntimeStatus};
use std::{
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    path::PathBuf,
    sync::Mutex,
    time::Duration,
};
use tauri::State;

pub struct AppState {
    pub runtime: Mutex<RuntimeStatus>,
}
impl Default for AppState {
    fn default() -> Self {
        Self {
            runtime: Mutex::new(RuntimeStatus::stopped(runtime_origin())),
        }
    }
}
fn runtime_origin() -> String {
    std::env::var("OMNIROUTE_RUNTIME_ORIGIN").unwrap_or_else(|_| "http://localhost:20128".into())
}
fn runtime_addr(origin: &str) -> Result<SocketAddr, String> {
    let (authority, default_port) = if let Some(rest) = origin.strip_prefix("http://") {
        (rest, 80)
    } else if let Some(rest) = origin.strip_prefix("https://") {
        (rest, 443)
    } else {
        return Err("invalid runtime origin".to_string());
    };
    let authority = authority.split('/').next().unwrap_or_default();
    if authority.is_empty() {
        return Err("invalid runtime origin".to_string());
    }
    let host_port = if authority.starts_with('[') {
        let end = authority
            .find(']')
            .ok_or_else(|| "invalid runtime origin".to_string())?;
        let host = &authority[..=end];
        let port = authority[end + 1..].strip_prefix(':').unwrap_or("");
        format!(
            "{host}:{}",
            if port.is_empty() {
                default_port.to_string()
            } else {
                port.to_string()
            }
        )
    } else if authority.matches(':').count() == 1 {
        authority.to_string()
    } else {
        format!("{authority}:{default_port}")
    };
    host_port
        .to_socket_addrs()
        .map_err(|_| "invalid runtime origin".to_string())?
        .next()
        .ok_or_else(|| "invalid runtime origin".to_string())
}

#[tauri::command]
pub fn runtime_start(state: State<'_, AppState>) -> Result<RuntimeStatus, String> {
    let mut runtime = state
        .runtime
        .lock()
        .map_err(|_| "runtime state lock poisoned".to_string())?;
    if runtime.state == RuntimeState::Running {
        return Ok(runtime.clone());
    }
    runtime.state = RuntimeState::Starting;
    let addr = match runtime_addr(&runtime.origin) {
        Ok(addr) => addr,
        Err(error) => {
            runtime.state = RuntimeState::Stopped;
            return Err(error);
        }
    };
    runtime.state = if TcpStream::connect_timeout(&addr, Duration::from_millis(150)).is_ok() {
        RuntimeState::Running
    } else {
        RuntimeState::Stopped
    };
    Ok(runtime.clone())
}

#[tauri::command]
pub fn runtime_stop(state: State<'_, AppState>) -> Result<RuntimeStatus, String> {
    let mut runtime = state
        .runtime
        .lock()
        .map_err(|_| "runtime state lock poisoned".to_string())?;
    runtime.state = RuntimeState::Stopped;
    Ok(runtime.clone())
}
#[tauri::command]
pub fn runtime_readiness(state: State<'_, AppState>) -> Result<RuntimeStatus, String> {
    state
        .runtime
        .lock()
        .map(|runtime| runtime.clone())
        .map_err(|_| "runtime state lock poisoned".to_string())
}
#[tauri::command]
pub fn runtime_data_dir() -> Result<String, String> {
    if let Ok(path) = std::env::var("DATA_DIR").or_else(|_| std::env::var("OMNIROUTE_DATA_DIR")) {
        return Ok(path);
    }
    #[cfg(target_os = "windows")]
    let base = std::env::var("APPDATA").map(PathBuf::from);
    #[cfg(not(target_os = "windows"))]
    let base = std::env::var("HOME").map(|home| PathBuf::from(home).join(".omniroute"));
    base.map(|path| path.to_string_lossy().into_owned())
        .map_err(|_| "home directory unavailable".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resolves_default_localhost_origin() {
        assert_eq!(
            runtime_addr("http://localhost:20128").unwrap().port(),
            20128
        );
    }
    #[test]
    fn rejects_origin_without_scheme() {
        assert!(runtime_addr("localhost:20128").is_err());
    }
}
#[tauri::command]
pub fn dashboard_origin(state: State<'_, AppState>) -> Result<String, String> {
    state
        .runtime
        .lock()
        .map(|runtime| runtime.origin.clone())
        .map_err(|_| "runtime state lock poisoned".to_string())
}
