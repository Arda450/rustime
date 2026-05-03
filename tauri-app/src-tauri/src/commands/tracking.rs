use std::sync::{atomic::Ordering, Arc};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};

use crate::dto::activity::ActivityDto;
use crate::error::ApiError;
use rustime_core::models::WindowActivity;
use rustime_db::get_activities_with_projects;
use rustime_tracking::{
    current_timestamp, try_get_active_window_title, TrackingError, TrackingState,
};

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
    let active_project = Arc::clone(&state.active_project);
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
                // Aktives Projekt (id, name) holen
                let proj = active_project.lock().ok().and_then(|g| g.clone());

                // In SQLite speichern
                if let Ok(db_conn) = db.lock() {
                    if let Some((pid, _)) = &proj {
                        if let Err(e) = rustime_db::insert_activity_with_project(&db_conn, &activity, *pid) {
                            eprintln!("DB insert error: {}", e);
                        }
                    }
                }

                // Event mit Projekt-Info ans Frontend
                let dto = ActivityDto {
                    title: activity.title,
                    timestamp: activity.timestamp,
                    project_id: proj.as_ref().map(|(id, _)| *id),
                    project_name: proj.map(|(_, name)| name),
                };
                let _ = app_handle.emit("new-activity", dto);
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

/// Gibt alle Aktivitäten inkl. Projekt-Info zurück (für UI-Liste).
#[tauri::command]
pub fn get_activities(state: State<TrackingState>) -> Result<Vec<ActivityDto>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_with_projects(&db_conn).map_err(ApiError::from)?;
    Ok(rows
        .into_iter()
        .map(|r| ActivityDto {
            title: r.title,
            timestamp: r.timestamp,
            project_id: r.project_id,
            project_name: r.project_name,
        })
        .collect())
}

#[tauri::command]
pub fn is_tracking(state: State<TrackingState>) -> bool {
    state.is_running.load(Ordering::SeqCst)
}
