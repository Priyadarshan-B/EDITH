use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            println!("EDITH Desktop application initialized.");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running EDITH desktop application");
}
