mod commands;
mod dto;
mod error;

use commands::{
    export_activities_json_to_downloads,
    get_activities,
    is_tracking,
    show_activities_json,
    start_tracking,
    stop_tracking,
};
use rustime_db::init_database;
use rustime_tracking::TrackingState;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = init_database().unwrap_or_else(|e| panic!("Failed to initialize database: {}", e));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(TrackingState::new(db))
        .invoke_handler(tauri::generate_handler![
            start_tracking,
            stop_tracking,
            get_activities,
            is_tracking,
            show_activities_json,
            export_activities_json_to_downloads,
        ])
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("error while running tauri application");
}
