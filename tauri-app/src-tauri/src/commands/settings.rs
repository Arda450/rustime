use tauri::State;

use crate::error::ApiError;
use rustime_db::{count_activities, count_projects, delete_all_activities, delete_all_projects};
use rustime_tracking::TrackingState;

#[derive(serde::Serialize)]
pub struct AppStats {
    pub activity_count: i64,
    pub project_count: i64,
}

#[tauri::command]
pub fn get_app_stats(state: State<TrackingState>) -> Result<AppStats, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let activity_count = count_activities(&db_conn).map_err(ApiError::from)?;
    let project_count = count_projects(&db_conn).map_err(ApiError::from)?;

    Ok(AppStats {
        activity_count,
        project_count,
    })
}

#[tauri::command]
pub fn clear_all_activities(state: State<TrackingState>) -> Result<usize, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let count = delete_all_activities(&db_conn).map_err(ApiError::from)?;

    drop(db_conn);

    if let Ok(mut activities) = state.activities.lock() {
        activities.clear();
    }

    Ok(count)
}

#[tauri::command]
pub fn clear_all_projects(state: State<TrackingState>) -> Result<usize, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    delete_all_activities(&db_conn).map_err(ApiError::from)?;
    let count = delete_all_projects(&db_conn).map_err(ApiError::from)?;

    drop(db_conn);

    if let Ok(mut activities) = state.activities.lock() {
        activities.clear();
    }
    if let Ok(mut active_project) = state.active_project.lock() {
        *active_project = None;
    }

    Ok(count)
}
