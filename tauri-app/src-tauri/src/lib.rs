// startpunkt der tauri app. hier befinden sich die main funktionen und die initialisierung der app.

// lokale module imports
mod commands;
mod dto;
mod error;

// externe funktionen importieren
use commands::{
    export_activities_json_to_downloads, get_activities, is_tracking, show_activities_json,
    start_tracking, stop_tracking, select_project_path, get_projects,
};

// db und tracking state importieren aus den crates
use rustime_db::init_database;
use rustime_tracking::TrackingState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // db initialisieren
    let db = init_database().unwrap_or_else(|e| panic!("Failed to initialize database: {}", e));

    // app builder initialisieren, erzeugt ein neues builder objekt
    tauri::Builder::default()
        // plugin initialisieren
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TrackingState::new(db))
        .invoke_handler(tauri::generate_handler![
            select_project_path, // dialog zur projektauswahl
            get_projects, // listet alle projekte auf
            start_tracking, // startet die tracking funktion
            stop_tracking, // stoppt die tracking funktion
            get_activities, // listet alle aktivitäten auf
            is_tracking, // prüft ob die tracking funktion läuft    
            show_activities_json, // zeigt die aktivitäten in einer ui an   
            export_activities_json_to_downloads, // exportiert die aktivitäten in eine json datei
        ])
        .run(tauri::generate_context!("tauri.conf.json")) //startet die tauri anwendung
        .expect("error while running tauri application");
}
