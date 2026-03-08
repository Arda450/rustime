// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::{atomic::Ordering, Arc};
use std::thread;
use std::time::Duration;
use tauri::State;
use tauri::{AppHandle, Emitter};

// Re-exports from workspace crates
use rustime_core::models::WindowActivity;
use rustime_db::{init_database, insert_activity};
use rustime_tracking::{current_timestamp, get_active_window_title, TrackingState};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_current_window() -> String {
    get_active_window_title()
}

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
            let title = get_active_window_title();

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
                    let _ = insert_activity(&db_conn, &activity);
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
fn get_activities(state: State<TrackingState>) -> Vec<WindowActivity> {
    if let Ok(db_conn) = state.db.lock() {
        rustime_db::get_all_activities(&db_conn).unwrap_or_default()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn is_tracking(state: State<TrackingState>) -> bool {
    state.is_running.load(Ordering::SeqCst)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = init_database().expect("Failed to initialize database");
    println!("Database initialized"); // Debugging
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(TrackingState::new(db))
        .invoke_handler(tauri::generate_handler![
            greet,
            get_current_window,
            start_tracking,
            stop_tracking,
            get_activities,
            is_tracking,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
