//! sharecli-tray — Linux system-tray client for sharecli.
//!
//! Renders a StatusNotifierItem tray (via `ksni`, the KDE/freedesktop SNI
//! protocol) that mirrors the macOS Swift tray and Windows WinUI 3 tray: it
//! shows managed-process health and lets the user kill processes. All data
//! comes from the same `sharecli-ipc` daemon over the Unix socket — see `ipc`.
//!
//! Non-Linux targets get a stub `main` so `cargo build --workspace` stays green
//! everywhere; the SNI protocol only exists on freedesktop desktops.

mod ipc;

#[cfg(target_os = "linux")]
fn main() {
    linux::run();
}

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("sharecli-tray: the system tray is only supported on Linux (StatusNotifierItem).");
    eprintln!("On macOS use the Swift tray (desktop/), on Windows the WinUI 3 tray (windows/).");
    std::process::exit(1);
}

#[cfg(target_os = "linux")]
mod linux {
    use std::time::Duration;

    use ksni::blocking::{Handle, TrayMethods};

    use crate::ipc;

    const POLL_INTERVAL: Duration = Duration::from_secs(3);

    /// Snapshot of daemon state rendered into the tray. Refreshed by the poll
    /// thread via `handle.update`.
    #[derive(Default)]
    struct ShareCliTray {
        processes: Vec<ipc::ProcessSummary>,
        health: Option<ipc::HealthSnapshot>,
        connected: bool,
    }

    impl ksni::Tray for ShareCliTray {
        fn id(&self) -> String {
            "sharecli".into()
        }

        fn title(&self) -> String {
            "ShareCLI".into()
        }

        // Prefer a themed icon; fall back to a stock name shipped by every icon
        // theme so the tray is never blank.
        fn icon_name(&self) -> String {
            if self.connected {
                "utilities-system-monitor".into()
            } else {
                "dialog-warning".into()
            }
        }

        fn tool_tip(&self) -> ksni::ToolTip {
            let description = match (&self.health, self.connected) {
                (Some(h), true) => format!(
                    "{} managed · {} / {} MB{}",
                    h.managed_processes,
                    h.used_memory_mb,
                    h.total_memory_mb,
                    if h.healthy { "" } else { " · UNHEALTHY" },
                ),
                _ => "sharecli daemon not reachable".into(),
            };
            ksni::ToolTip {
                title: "ShareCLI".into(),
                description,
                icon_name: self.icon_name(),
                icon_pixmap: Vec::new(),
            }
        }

        fn menu(&self) -> Vec<ksni::MenuItem<Self>> {
            use ksni::menu::*;

            let mut items: Vec<ksni::MenuItem<Self>> = Vec::new();

            let header = match (&self.health, self.connected) {
                (Some(h), true) => format!(
                    "{} process(es) · {} / {} MB",
                    h.managed_processes, h.used_memory_mb, h.total_memory_mb
                ),
                _ => "Daemon offline".into(),
            };
            items.push(StandardItem { label: header, enabled: false, ..Default::default() }.into());
            items.push(MenuItem::Separator);

            if self.processes.is_empty() {
                let label = if self.connected {
                    "No managed processes".to_string()
                } else {
                    "Start sharecli-ipc to connect".to_string()
                };
                items.push(StandardItem { label, enabled: false, ..Default::default() }.into());
            } else {
                for proc in &self.processes {
                    let submenu = build_process_submenu(proc);
                    let label = format!(
                        "{} [{}]{}",
                        proc.name,
                        proc.pid,
                        proc.project.as_deref().map(|p| format!(" · {p}")).unwrap_or_default(),
                    );
                    items.push(SubMenu { label, submenu, ..Default::default() }.into());
                }
            }

            items.push(MenuItem::Separator);
            items.push(
                StandardItem {
                    label: "Kill All Managed".into(),
                    icon_name: "edit-delete".into(),
                    enabled: !self.processes.is_empty(),
                    activate: Box::new(|_this: &mut Self| {
                        if let Err(e) = ipc::kill_all() {
                            tracing::warn!("kill_all failed: {e}");
                        }
                    }),
                    ..Default::default()
                }
                .into(),
            );
            items.push(
                StandardItem {
                    label: "Refresh".into(),
                    icon_name: "view-refresh".into(),
                    activate: Box::new(|this: &mut Self| refresh(this)),
                    ..Default::default()
                }
                .into(),
            );
            items.push(MenuItem::Separator);
            items.push(
                StandardItem {
                    label: "Quit".into(),
                    icon_name: "application-exit".into(),
                    activate: Box::new(|_this: &mut Self| std::process::exit(0)),
                    ..Default::default()
                }
                .into(),
            );

            items
        }
    }

    fn build_process_submenu(proc: &ipc::ProcessSummary) -> Vec<ksni::MenuItem<ShareCliTray>> {
        use ksni::menu::*;

        let pid = proc.pid;
        vec![
            StandardItem {
                label: format!("Memory: {} MB", proc.memory_mb),
                enabled: false,
                ..Default::default()
            }
            .into(),
            StandardItem {
                label: format!("Harness: {}", proc.harness.as_deref().unwrap_or("—")),
                enabled: false,
                ..Default::default()
            }
            .into(),
            MenuItem::Separator,
            StandardItem {
                label: "Kill".into(),
                icon_name: "process-stop".into(),
                activate: Box::new(move |_this: &mut ShareCliTray| {
                    if let Err(e) = ipc::kill(pid) {
                        tracing::warn!("kill pid {pid} failed: {e}");
                    }
                }),
                ..Default::default()
            }
            .into(),
        ]
    }

    /// Pull the latest state from the IPC daemon into the tray struct.
    fn refresh(tray: &mut ShareCliTray) {
        match ipc::health() {
            Ok(h) => {
                tray.health = Some(h);
                tray.connected = true;
            }
            Err(e) => {
                tracing::debug!("health poll failed: {e}");
                tray.connected = false;
                tray.health = None;
            }
        }
        match ipc::list_processes() {
            Ok(procs) => tray.processes = procs,
            Err(e) => {
                tracing::debug!("process.list poll failed: {e}");
                tray.processes.clear();
            }
        }
    }

    pub fn run() {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "sharecli_tray=info".into()),
            )
            .init();

        let mut initial = ShareCliTray::default();
        refresh(&mut initial);

        let handle: Handle<ShareCliTray> = match initial.spawn() {
            Ok(h) => h,
            Err(e) => {
                eprintln!("sharecli-tray: failed to register StatusNotifierItem: {e}");
                eprintln!("Is a system tray / AppIndicator host running on this desktop?");
                std::process::exit(1);
            }
        };
        tracing::info!("sharecli-tray registered; polling every {}s", POLL_INTERVAL.as_secs());

        loop {
            std::thread::sleep(POLL_INTERVAL);
            if handle.is_closed() {
                break;
            }
            // The closure runs on the service thread with exclusive access to
            // the tray struct; returning triggers a menu/icon re-render.
            handle.update(refresh);
        }
    }
}
