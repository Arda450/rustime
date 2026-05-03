// startpunkt der tauri app. hier befinden sich die main funktionen und die initialisierung der app.

// lokale module imports
mod commands;
mod dto;
mod error;

// externe funktionen importieren
use commands::{
    clear_all_activities, clear_all_projects, export_activities_json_to_downloads, get_activities,
    get_active_project, get_app_stats, get_projects, is_tracking, select_project_path,
    show_activities_json, start_tracking, stop_tracking, set_active_project,
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
            set_active_project, // setzt das aktive projekt
            select_project_path, // dialog zur projektauswahl
            get_projects, // listet alle projekte auf
            get_active_project, // gibt das aktive projekt zurück
            start_tracking, // startet die tracking funktion
            stop_tracking, // stoppt die tracking funktion
            get_activities, // listet alle aktivitäten auf
            is_tracking, // prüft ob die tracking funktion läuft
            show_activities_json, // zeigt die aktivitäten in einer ui an
            export_activities_json_to_downloads, // exportiert die aktivitäten in eine json datei
            get_app_stats, // gibt statistiken über die app zurück
            clear_all_activities, // löscht alle aktivitäten
            clear_all_projects, // löscht alle projekte (und aktivitäten)
        ])
        .run(tauri::generate_context!("tauri.conf.json")) //startet die tauri anwendung
        .expect("error while running tauri application");
}
