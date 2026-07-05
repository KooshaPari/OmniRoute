use tauri::Manager;
mod commands;
mod error;
mod gateway;
mod tray;

use gateway::GatewayProcess;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let gateway = GatewayProcess::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_stronghold::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let _ = tray::setup_tray(app.handle());
            Ok(())
        })
        .manage(gateway)
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::app::get_version,
            commands::app::quit,
            commands::device::get_device_id,
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::gateway_status,
            commands::cert::install_cert,
            commands::proxy::get_proxy_settings,
            commands::tray::show_tray,
            commands::tray::hide_tray,
            commands::notification::notify,
            commands::updater::check_for_update,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::os::get_platform,
            commands::os::get_arch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
