use std::sync::{atomic::Ordering, Arc};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};

use crate::error::ApiError;
use rustime_core::models::WindowActivity;
use rustime_db::{get_all_activities, insert_activity};
use rustime_tracking::{current_timestamp, try_get_active_window_title, TrackingError, TrackingState};

#[tauri::command]
pub fn start_tracking(state: State<TrackingState>, app: AppHandle) {
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
pub fn stop_tracking(state: State<TrackingState>) {
    state.is_running.store(false, Ordering::SeqCst);
}

// command für das frontend, ruft get_all_activities aus der activity_repo.rs auf und gibt sie als vector von windowactivities zurück
#[tauri::command]
pub fn get_activities(state: State<TrackingState>) -> Result<Vec<WindowActivity>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    get_all_activities(&db_conn).map_err(ApiError::from)
}

#[tauri::command]
pub fn is_tracking(state: State<TrackingState>) -> bool {
    state.is_running.load(Ordering::SeqCst)
}