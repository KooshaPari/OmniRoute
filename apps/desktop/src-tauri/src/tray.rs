use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

pub fn build<R: Runtime>() -> tauri::tray::TrayIconBuilder<R> {
    TrayIconBuilder::new()
        .icon(app_icon())
        .tooltip("argismonitor")
}

fn app_icon<R: Runtime>() -> tauri::image::Image<'static> {
    // Placeholder 1x1 PNG (will be replaced by tauri icon command in CI).
    tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
        .expect("placeholder icon")
}

pub fn on_event<R: Runtime>(tray: &tauri::tray::TrayIcon<R>, event: TrayIconEvent) {
    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
