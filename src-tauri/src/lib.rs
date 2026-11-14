use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_shell::ShellExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            println!("EDITH Desktop application initialized.");

            // 1. Setup System Tray Menu
            let show_i = MenuItem::with_id(app, "show", "Show EDITH HUD", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide to Tray", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit EDITH", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // 2. Production Sidecar Management
            #[cfg(not(debug_assertions))]
            {
                if let Ok(sidecar_cmd) = app.shell().sidecar("edith_backend") {
                    let _ = sidecar_cmd.spawn();
                    println!("EDITH backend sidecar initialized.");
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running EDITH desktop application");
}
