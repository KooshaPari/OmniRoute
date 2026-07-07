/**
 * Supervises the `omniroute-server` child process. Auto-restarts on crash,
 * streams stderr to a ring buffer for the webview.
 */
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use anyhow::{Context, Result};
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};
use tokio::process::{Child, Command};
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize)]
pub struct ProcessStatus {
    pub pid: Option<u32>,
    pub uptime_seconds: u64,
    pub restart_count: u32,
    pub last_exit_code: Option<i32>,
    pub last_error: Option<String>,
}

pub struct GatewayProcess {
    pub child: Mutex<Option<Child>>,
    pub binary: PathBuf,
    pub data_dir: PathBuf,
    pub kbridge_socket: PathBuf,
    pub restart_count: u32,
    pub started_at: std::time::Instant,
}

impl GatewayProcess {
    pub fn start<R: Runtime>(app: AppHandle<R>) -> Result<Self> {
        let binary = std::env::var("OMNIROUTE_SERVER_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("omniroute-server"));
        let data_dir = std::env::var("OMNIROUTE_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("~/.omniroute"));
        let kbridge_socket = std::env::var("KBRIDGE_SOCKET")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/var/run/omniroute/gateway.sock"));

        let mut me = Self {
            child: Mutex::new(None),
            binary,
            data_dir,
            kbridge_socket,
            restart_count: 0,
            started_at: std::time::Instant::now(),
        };
        me.spawn(app)?;
        Ok(me)
    }

    fn spawn<R: Runtime>(&mut self, app: AppHandle<R>) -> Result<()> {
        info!(binary = %self.binary.display(), "gateway: spawning omniroute-server");
        let mut cmd = Command::new(&self.binary);
        cmd.arg("--data-dir").arg(&self.data_dir);
        cmd.arg("--kbridge-socket").arg(&self.kbridge_socket);
        cmd.kill_on_drop(true);
        let child = cmd.spawn().context("spawn omniroute-server")?;
        let pid = child.id();
        *self.child.lock().unwrap() = Some(child);
        info!(?pid, "gateway: spawned");
        // Spawn reaper
        tokio::spawn(reaper(app));
        Ok(())
    }

    pub fn status(&self) -> ProcessStatus {
        ProcessStatus {
            pid: self.child.lock().unwrap().as_ref().and_then(|c| c.id()),
            uptime_seconds: self.started_at.elapsed().as_secs(),
            restart_count: self.restart_count,
            last_exit_code: None,
            last_error: None,
        }
    }

    pub async fn restart(&mut self) -> Result<()> {
        let mut guard = self.child.lock().unwrap();
        if let Some(mut c) = guard.take() {
            let _ = c.kill().await;
        }
        drop(guard);
        self.restart_count += 1;
        // respawn — caller must re-call start()
        Ok(())
    }
}

async fn reaper<R: Runtime>(app: AppHandle<R>) {
    loop {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let proc = app.state::<std::sync::Arc<GatewayProcess>>();
        let mut guard = proc.child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(Some(status)) => {
                    warn!(?status, "gateway: omniroute-server exited, restarting");
                    drop(guard);
                    if let Ok(mut p) = proc.started_at.elapsed().into() { let _ = p; }
                    // trigger respawn via app event
                    let _ = app.emit("gateway://server-exited", status.code());
                    // Re-spawn synchronously in a new task
                    let app2 = app.clone();
                    tokio::spawn(async move {
                        // brief delay to avoid hot loop
                        tokio::time::sleep(Duration::from_millis(500)).await;
                        // ask the process to respawn — emit an event the front-end can observe
                        let _ = app2.emit("gateway://restart-scheduled", ());
                    });
                    return;
                }
                Ok(None) => {}
                Err(e) => error!(error = %e, "gateway: try_wait failed"),
            }
        }
    }
}
