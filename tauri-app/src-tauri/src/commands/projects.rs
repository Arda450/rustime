use std::path::Path;
use tauri::State;

use crate::dto::project::ProjectDto;
use crate::error::ApiError;
use rustime_db::{list_projects, upsert_project};
use rustime_tracking::{current_timestamp, TrackingState};

fn name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string()
}

#[tauri::command]
pub fn select_project_path(state: State<TrackingState>, path: String) -> Result<ProjectDto, ApiError> {
    let name = name_from_path(&path);

    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let project = upsert_project(&db_conn, &name, &path, current_timestamp()).map_err(ApiError::from)?;

    drop(db_conn);

    let mut active = state
        .active_project
        .lock()
        .map_err(|_| ApiError::new("LOCK_POISONED", "Projekt-Lock fehlgeschlagen"))?;
    *active = Some((project.id, project.name.clone()));

    Ok(ProjectDto { id: project.id, name: project.name, path: project.path })
}

#[tauri::command]
pub fn get_projects(state: State<TrackingState>) -> Result<Vec<ProjectDto>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = list_projects(&db_conn).map_err(ApiError::from)?;
    Ok(rows.into_iter().map(|p| ProjectDto { id: p.id, name: p.name, path: p.path }).collect())
}