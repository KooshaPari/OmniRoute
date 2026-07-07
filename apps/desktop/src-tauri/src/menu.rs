use tauri::{AppHandle, Manager, Runtime};

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let window = app.get_webview_window("main").unwrap();
    let menu = tauri::menu::MenuBuilder::new(app)
        .item(
            &tauri::menu::SubmenuBuilder::new(app, "argismonitor")
                .item(
                    &tauri::menu::MenuItemBuilder::new("About")
                        .id("about")
                        .build(app)?,
                )
                .separator()
                .item(
                    &tauri::menu::MenuItemBuilder::new("Hide")
                        .accelerator("CmdOrCtrl+H")
                        .id("hide")
                        .build(app)?,
                )
                .separator()
                .item(
                    &tauri::menu::MenuItemBuilder::new("Quit")
                        .accelerator("CmdOrCtrl+Q")
                        .id("quit")
                        .build(app)?,
                )
                .build()?,
        )
        .item(
            &tauri::menu::SubmenuBuilder::new(app, "View")
                .item(
                    &tauri::menu::MenuItemBuilder::new("Reload")
                        .accelerator("CmdOrCtrl+R")
                        .id("reload")
                        .build(app)?,
                )
                .item(
                    &tauri::menu::MenuItemBuilder::new("Toggle Devtools")
                        .accelerator("CmdOrCtrl+Shift+I")
                        .id("devtools")
                        .build(app)?,
                )
                .build()?,
        )
        .build()?;
    window.set_menu(menu)?;
    Ok(())
}
