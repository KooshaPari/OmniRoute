#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
mod lifecycle;

fn main() {
    tauri::Builder::default()
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![commands::runtime_start, commands::runtime_stop, commands::runtime_readiness, commands::runtime_data_dir, commands::dashboard_origin])
        .run(tauri::generate_context!())
        .expect("error while running OmniRoute desktop");
}
