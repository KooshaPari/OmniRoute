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
    runtime_origin_from(std::env::var("OMNIROUTE_RUNTIME_ORIGIN").ok())
}
fn runtime_origin_from(value: Option<String>) -> String {
    value.unwrap_or_else(|| "http://localhost:20128".into())
}
fn runtime_addr(origin: &str) -> Result<SocketAddr, String> {
    let (authority, default_port) = if let Some(rest) = origin.strip_prefix("http://") {
        (rest, 80)
    } else if let Some(rest) = origin.strip_prefix("https://") {
        (rest, 443)
    } else {
        return Err("invalid runtime origin".to_string());
    };
    let authority = authority.split(['/', '?', '#']).next().unwrap_or_default();
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

fn apply_probe_result(runtime: &mut RuntimeStatus, reachable: bool) {
    runtime.state = if reachable {
        RuntimeState::Running
    } else {
        RuntimeState::Stopped
    };
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
    apply_probe_result(
        &mut runtime,
        TcpStream::connect_timeout(&addr, Duration::from_millis(150)).is_ok(),
    );
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
    if let Some(path) =
        std::env::var_os("DATA_DIR").or_else(|| std::env::var_os("OMNIROUTE_DATA_DIR"))
    {
        return Ok(PathBuf::from(path).to_string_lossy().into_owned());
    }
    #[cfg(target_os = "windows")]
    let fallback = std::env::var_os("APPDATA").map(|path| PathBuf::from(path).join("omniroute"));
    #[cfg(target_os = "macos")]
    let fallback = std::env::var_os("HOME")
        .map(|path| PathBuf::from(path).join("Library/Application Support/omniroute"));
    #[cfg(all(unix, not(target_os = "macos")))]
    let fallback = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|path| PathBuf::from(path).join(".local/share")))
        .map(|path| path.join("omniroute"));
    fallback
        .map(|path| path.to_string_lossy().into_owned())
        .ok_or_else(|| "application data directory unavailable".to_string())
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
    fn default_runtime_origin_is_localhost() {
        assert_eq!(runtime_origin_from(None), "http://localhost:20128");
    }
    #[test]
    fn rejects_origin_without_scheme() {
        assert!(runtime_addr("localhost:20128").is_err());
    }
    #[test]
    fn failed_start_does_not_remain_starting() {
        let mut status = RuntimeStatus {
            state: RuntimeState::Starting,
            origin: "http://localhost:20128".into(),
        };
        apply_probe_result(&mut status, false);
        assert_eq!(status.state, RuntimeState::Stopped);
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
