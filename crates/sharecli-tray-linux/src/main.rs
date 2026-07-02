//! sharecli-tray — Linux systemtray client using freedesktop (ksni).
//!
//! Connects to the sharecli-ipc server over Unix socket and exposes
//! a tray icon with process list and health status.

#[cfg(target_os = "linux")]
use anyhow::Result;
#[cfg(target_os = "linux")]
use ksni::{menu::*, IconPixmap, Tray, TrayService};
#[cfg(target_os = "linux")]
use std::sync::Arc;
#[cfg(target_os = "linux")]
use tokio::sync::Mutex;
#[cfg(target_os = "linux")]
use tracing::info;

mod ipc;
#[cfg(target_os = "linux")]
use ipc::{IPCClient, ProcessInfo};

#[cfg(target_os = "linux")]
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    // Create the IPC client.
    let client = Arc::new(Mutex::new(IPCClient::new()));

    // Create the tray service.
    let tray = Arc::new(MyTray {
        client: client.clone(),
        processes: Arc::new(Mutex::new(Vec::new())),
    });

    // Register with the systemtray service.
    let service = TrayService::new(tray);
    let handle = service.register().await?;

    info!("sharecli tray registered with systemtray service");

    // Run indefinitely.
    std::future::pending().await
}

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("sharecli-tray is only supported on Linux");
    std::process::exit(1);
}

struct MyTray {
    client: Arc<Mutex<IPCClient>>,
    processes: Arc<Mutex<Vec<ProcessInfo>>>,
}

#[ksni::dbus_interface]
impl Tray for MyTray {
    #[dbus_interface(property)]
    async fn category(&self) -> String {
        "ApplicationStatus".into()
    }

    #[dbus_interface(property)]
    async fn id(&self) -> String {
        "sharecli".into()
    }

    #[dbus_interface(property)]
    async fn title(&self) -> String {
        "sharecli".into()
    }

    #[dbus_interface(property)]
    async fn status(&self) -> String {
        "Active".into()
    }

    #[dbus_interface(property)]
    async fn window_id(&self) -> i32 {
        0
    }

    #[dbus_interface(property)]
    async fn icon_name(&self) -> String {
        "process-manager".into()
    }

    #[dbus_interface(property)]
    async fn icon_pixmap(&self) -> Vec<IconPixmap> {
        vec![]
    }

    #[dbus_interface(property)]
    async fn attention_icon_name(&self) -> String {
        String::new()
    }

    #[dbus_interface(property)]
    async fn attention_icon_pixmap(&self) -> Vec<IconPixmap> {
        vec![]
    }

    #[dbus_interface(property)]
    async fn overlay_icon_name(&self) -> String {
        String::new()
    }

    #[dbus_interface(property)]
    async fn overlay_icon_pixmap(&self) -> Vec<IconPixmap> {
        vec![]
    }

    #[dbus_interface(property)]
    async fn tooltip_icon_name(&self) -> String {
        String::new()
    }

    #[dbus_interface(property)]
    async fn tooltip_icon_pixmap(&self) -> Vec<IconPixmap> {
        vec![]
    }

    #[dbus_interface(property)]
    async fn tooltip_title(&self) -> String {
        "sharecli Process Manager".into()
    }

    #[dbus_interface(property)]
    async fn tooltip_body(&self) -> String {
        let client = self.client.lock().await;
        match client.health_snapshot().await {
            Ok(health) => {
                format!(
                    "Managed: {} | Memory: {} MB",
                    health.managed_processes, health.used_memory_mb
                )
            }
            Err(_) => "Unavailable".into(),
        }
    }

    #[dbus_interface(property)]
    async fn tooltip_icon_name(&self) -> String {
        String::new()
    }

    #[dbus_interface(property)]
    async fn tooltip_icon_pixmap(&self) -> Vec<IconPixmap> {
        vec![]
    }

    #[dbus_interface(property)]
    async fn menu(&self) -> ksni::menu::DbusMenu {
        ksni::menu::DbusMenu("/".into())
    }

    async fn context_menu(&self, _x: i32, _y: i32) {
        let client = self.client.lock().await;
        match client.process_list().await {
            Ok(procs) => {
                let mut processes = self.processes.lock().await;
                *processes = procs;
                info!("Updated {} processes in menu", processes.len());
            }
            Err(e) => info!("Failed to fetch process list: {}", e),
        }
    }

    async fn activate(&self, _x: i32, _y: i32) {
        // Tray icon click: refresh process list.
        self.context_menu(0, 0).await;
    }

    async fn secondary_activate(&self, _x: i32, _y: i32) {
        // Right-click or wheel; context menu.
    }

    async fn scroll(&self, _delta: i32, _orientation: &str) {
        // Mouse wheel; volume/etc.
    }

    async fn new_title(&self) {
        // Emitted when title changes.
    }

    async fn new_icon(&self) {
        // Emitted when icon changes.
    }

    async fn new_attention_icon(&self) {
        // Emitted when attention icon changes.
    }

    async fn new_overlay_icon(&self) {
        // Emitted when overlay icon changes.
    }

    async fn new_tooltip(&self) {
        // Emitted when tooltip changes.
    }

    async fn new_icon_theme_path(&self) {
        // Emitted when theme path changes.
    }

    async fn new_menu(&self) {
        // Emitted when menu changes.
    }

    async fn new_status(&self, _status: &str) {
        // Emitted when status changes.
    }
}
