mod license;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            license::verify_and_activate,
            license::check_activated,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
