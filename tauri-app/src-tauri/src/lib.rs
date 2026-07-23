// startpunkt der tauri app. hier befinden sich die main funktionen und die initialisierung der app.

// lokale module imports
mod commands;
mod dto;
mod error;

// externe funktionen importieren
use commands::{
    clear_all_activities, clear_all_projects, create_project, delete_project,
    export_activities_csv_to_paths, export_activities_json_to_path, export_report_pdf_to_path,
    get_active_project, get_activities_page, get_app_stats, get_by_project_for_range,
    get_daily_report, get_dwell_by_category, get_overview_stats, get_projects,
    get_time_series_by_category, get_weekly_report, is_tracking, set_active_project,
    show_activities_json, start_tracking, stop_tracking,
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
            // commands registerieren, damit die frontend auf die commands zugreifen kann per invoke
            set_active_project,                  // setzt das aktive projekt
            create_project,                      // legt projekt per name an
            delete_project,                      // löscht ein projekt und dessen aktivitäten
            get_projects,                        // listet alle projekte auf
            get_active_project,                  // gibt das aktive projekt zurück
            start_tracking,                      // startet die tracking funktion
            stop_tracking,                       // stoppt die tracking funktion
            get_activities_page,                 // paginierte aktivitäten
            get_daily_report,                    // tagesbericht für ein projekt
            get_weekly_report,                   // wochenbericht für ein projekt
            get_by_project_for_range,            // lazy: zeit pro projekt für zeitraum
            get_dwell_by_category,               // verweildauer-segmente fürs pie-chart
            get_time_series_by_category,         // zeitverlauf pro kategorie
            get_overview_stats,                  // kompakte gesamtstatistik aller projekte
            is_tracking,                         // prüft ob die tracking funktion läuft
            show_activities_json,                // zeigt die aktivitäten in einer ui an
            export_activities_json_to_path,      // exportiert aktivitäten als json an zielpfad
            export_activities_csv_to_paths,      // exportiert aktivitäten als csv an zielpfade
            export_report_pdf_to_path,           // speichert einen bericht als pdf
            get_app_stats,                       // gibt statistiken über die app zurück
            clear_all_activities,                // löscht alle aktivitäten
            clear_all_projects,                  // löscht alle projekte (und aktivitäten)
        ])
        .run(tauri::generate_context!("tauri.conf.json")) //startet die tauri anwendung
        .expect("error while running tauri application");
}
