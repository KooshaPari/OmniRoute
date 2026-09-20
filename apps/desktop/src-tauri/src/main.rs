#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
mod lifecycle;
mod origin;
mod paths;
mod server_paths;
mod supervisor;

// Compiled for tests only; `build.rs` includes the same file to inject the
// optional-pack names it parses from `scripts/packs/optionalPackManifest.mjs`.
#[cfg(test)]
mod pack_manifest;

/// Label of the window declared in `tauri.conf.json`.
const MAIN_WINDOW_LABEL: &str = "main";

fn main() {
    tauri::Builder::default()
        // Registered for Rust-side use only (`open_external`): no capability
        // grants the webview `opener:*`, so the SPA cannot reach the OS opener
        // except through the scheme-checked command.
        .plugin(tauri_plugin_opener::init())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::runtime_start,
            commands::runtime_stop,
            commands::runtime_readiness,
            commands::runtime_data_dir,
            commands::dashboard_origin,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::open_external
        ])
        .build(tauri::generate_context!())
        .expect("error while building the OmniRoute desktop shell")
        .run(handle_run_event);
}

fn handle_run_event(app: &tauri::AppHandle, event: tauri::RunEvent) {
    match event {
        // Leaving the event loop is the last chance to stop the server, so no
        // orphan keeps the port (or, on Windows, the executable lock).
        tauri::RunEvent::Exit => commands::shutdown(app),
        // Closing the main window on a platform that keeps the process alive
        // must not leave the server running either. Idempotent, so the later
        // `Exit` is harmless.
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Destroyed,
            ..
        } if label == MAIN_WINDOW_LABEL => commands::shutdown(app),
        _ => {}
    }
}
