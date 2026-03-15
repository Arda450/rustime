use std::sync::{atomic::Ordering, Arc};
use std::thread;
use std::time::Duration;
use tauri::State;
use tauri::{AppHandle, Emitter};
mod error;
use error::ApiError;

// Re-exports from workspace crates
use rustime_core::models::WindowActivity;
use rustime_db::{init_database, insert_activity};
use rustime_tracking::{current_timestamp, try_get_active_window_title, TrackingState, TrackingError};

// #[tauri::command]
// fn get_current_window() -> Result<String, ApiError> {
//     try_get_active_window_title().map_err(ApiError::from)
// }

#[tauri::command]
fn start_tracking(state: State<TrackingState>, app: AppHandle) {
    // Prüfen ob schon läuft
    if state.is_running.load(Ordering::SeqCst) {
        return;
    }

    // Flag setzen
    state.is_running.store(true, Ordering::SeqCst);

    // Klone für den Thread (Arc erlaubt das)
    let is_running = Arc::clone(&state.is_running);
    let activities = Arc::clone(&state.activities);
    let db = Arc::clone(&state.db);
    let app_handle = app.clone(); // Für den Thread

    // Hintergrund-Thread starten
    thread::spawn(move || {
        while is_running.load(Ordering::SeqCst) {
            // Fenstertitel holen
            let title = match try_get_active_window_title() {
                Ok(title) => title,
                Err(TrackingError::WindowNotFound | TrackingError::EmptyTitle) => {
                    thread::sleep(Duration::from_secs(2));
                    continue;
                }
                Err(e) => {
                    eprintln!("Tracking error: {}", e);
                    thread::sleep(Duration::from_secs(2));
                    continue;
                }
            };

            // Nur speichern wenn nicht leer
            if !title.is_empty() {
                let activity = WindowActivity {
                    title: title.clone(),
                    timestamp: current_timestamp(),
                };

                // In die Liste einfügen (RAM)
                if let Ok(mut list) = activities.lock() {
                    list.push(activity.clone());
                }
                // In SQLite speichern (Festplatte)
                if let Ok(db_conn) = db.lock() {
                    if let Err(e) = insert_activity(&db_conn, &activity) {
                        eprintln!("DB insert error: {}", e);
                    }
                }

                let _ = app_handle.emit("new-activity", activity);
            }

            // 2 Sekunden warten
            thread::sleep(Duration::from_secs(2));
        }
    });
}

#[tauri::command]
fn stop_tracking(state: State<TrackingState>) {
    state.is_running.store(false, Ordering::SeqCst);
}

#[tauri::command]
fn get_activities(state: State<TrackingState>) -> Result<Vec<WindowActivity>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;
    rustime_db::get_all_activities(&db_conn).map_err(ApiError::from)
}

#[tauri::command]
fn is_tracking(state: State<TrackingState>) -> bool {
    state.is_running.load(Ordering::SeqCst)
}

#[tauri::command]
fn export_activities_json(state: State<TrackingState>) -> Result<String, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;
    let activities = rustime_db::get_all_activities(&db_conn).map_err(ApiError::from)?;
    serde_json::to_string(&activities)
        .map_err(|e| ApiError::new("JSON_SERIALIZE_FAILED", e.to_string()))
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = init_database().unwrap_or_else(|e| panic!("Failed to initialize database: {}", e));
    println!("Database initialized"); // Debugging
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(TrackingState::new(db))
        .invoke_handler(tauri::generate_handler![
            start_tracking,
            stop_tracking,
            get_activities,
            is_tracking,
            export_activities_json,
        ])
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("error while running tauri application");
}