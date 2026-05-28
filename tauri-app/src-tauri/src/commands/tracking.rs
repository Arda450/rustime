//! Tracking-Commands: Fenstererfassung starten/stoppen und Aktivitäten abfragen.
//!
//! Der Polling-Loop läuft in einem Hintergrund-Thread. Persistenz nur in SQLite
//! (keine unbegrenzte RAM-Liste). UI-Events (`new-activity`) nur bei Titelwechsel.

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

/// Startet den Tracking-Loop (2-Sekunden-Intervall), falls noch nicht aktiv.
/// Schreibt bei gesetztem Projekt in die DB; benachrichtigt die UI nur bei neuem Fenstertitel.
#[tauri::command]
pub fn start_tracking(state: State<TrackingState>, app: AppHandle) {
    if state.is_running.load(Ordering::SeqCst) {
        return;
    }

    state.is_running.store(true, Ordering::SeqCst);

    let is_running = Arc::clone(&state.is_running);
    let db = Arc::clone(&state.db);
    let active_project = Arc::clone(&state.active_project);
    let app_handle = app.clone();

    thread::spawn(move || {
        let mut last_title: Option<String> = None;

        while is_running.load(Ordering::SeqCst) {
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

            if !title.is_empty() {
                let title_changed = last_title.as_deref() != Some(title.as_str());
                let activity = WindowActivity {
                    title: title.clone(),
                    timestamp: current_timestamp(),
                };

                let proj = active_project.lock().ok().and_then(|g| g.clone());

                if let Some((pid, _)) = &proj {
                    if let Ok(db_conn) = db.lock() {
                        if let Err(e) =
                            rustime_db::insert_activity_with_project(&db_conn, &activity, *pid)
                        {
                            eprintln!("DB insert error: {}", e);
                        }
                    }
                }

                // Push-Event ans Frontend nur bei Kontextwechsel (weniger WebView-Last)
                if title_changed {
                    last_title = Some(title);
                    let dto = ActivityDto::from_parts(
                        activity.title,
                        activity.timestamp,
                        proj.as_ref().map(|(id, _)| *id),
                        proj.map(|(_, name)| name),
                    );
                    let _ = app_handle.emit("new-activity", dto);
                }
            }

            thread::sleep(Duration::from_secs(2));
        }
    });
}

/// Stoppt den Hintergrund-Thread (setzt `is_running` auf false).
#[tauri::command]
pub fn stop_tracking(state: State<TrackingState>) {
    state.is_running.store(false, Ordering::SeqCst);
}

/// Liefert alle Aktivitäten mit Projekt-Info (Legacy, ohne Paginierung).
/// Bevorzugt für die UI: `get_activities_page` in `stats.rs`.
#[tauri::command]
pub fn get_activities(state: State<TrackingState>) -> Result<Vec<ActivityDto>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_with_projects(&db_conn).map_err(ApiError::from)?;

    Ok(rows
        .into_iter()
        .map(|r| ActivityDto::from_parts(r.title, r.timestamp, r.project_id, r.project_name))
        .collect())
}

/// Gibt zurück, ob der Tracking-Loop aktuell läuft.
#[tauri::command]
pub fn is_tracking(state: State<TrackingState>) -> bool {
    state.is_running.load(Ordering::SeqCst)
}
