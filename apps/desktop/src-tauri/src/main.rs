// argismonitor desktop entrypoint. Suppresses the console on Windows release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod menu;
mod tray;

use omniroute_gateway::{self as gateway};
use tauri::Manager;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(gateway::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_stronghold::Builder::default().build())
        .plugin(tauri_plugin_stream::init())
        .system_tray(tray::build())
        .on_system_tray_event(tray::on_event)
        .invoke_handler(tauri::generate_handler![
            commands::health::ping,
            commands::health::health,
            commands::process::status,
            commands::process::restart,
            commands::gateway::ping_kbridge,
            commands::gateway::health_kbridge,
            commands::gateway::combo_resolve,
            commands::gateway::usage_record,
            commands::logging::tail_logs,
        ])
        .setup(|app| {
            menu::install(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running argismonitor desktop");
}
