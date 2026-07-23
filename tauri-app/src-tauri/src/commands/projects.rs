//! Projekt-Commands: Projekte anlegen, listen und aktives Projekt setzen.
//!
//! Das aktive Projekt liegt zusätzlich im `TrackingState` (für Inserts im Tracking-Loop).

use tauri::State;

use crate::commands::tracking::stop_tracking_internal;
use crate::dto::project::ProjectDto;
use crate::error::ApiError;
use rustime_db::{
    create_project as create_project_db, delete_project as delete_project_db, get_project_by_id,
    list_projects,
};
use rustime_tracking::{current_timestamp, TrackingState};

/// Legt ein Projekt nur mit Namen an (ohne File-Explorer) und setzt es als aktiv.
#[tauri::command]
pub fn create_project(state: State<TrackingState>, name: String) -> Result<ProjectDto, ApiError> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err(ApiError::new(
            "INVALID_PROJECT_NAME",
            "Projektname darf nicht leer sein",
        ));
    }
    if trimmed.len() > 120 {
        return Err(ApiError::new(
            "INVALID_PROJECT_NAME",
            "Projektname ist zu lang (max. 120 Zeichen)",
        ));
    }

    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let project =
        create_project_db(&db_conn, &trimmed, current_timestamp()).map_err(ApiError::from)?;
    drop(db_conn);

    let mut active = state
        .active_project
        .lock()
        .map_err(|_| ApiError::new("LOCK_POISONED", "Projekt-Lock fehlgeschlagen"))?;
    *active = Some((project.id, project.name.clone()));

    Ok(ProjectDto {
        id: project.id,
        name: project.name,
        path: project.path,
    })
}

/// Listet alle in der Datenbank gespeicherten Projekte.
#[tauri::command]
pub fn get_projects(state: State<TrackingState>) -> Result<Vec<ProjectDto>, ApiError> {
    // Lesender Zugriff auf die DB; Rückgabe aller bekannten Projekte.
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    // Domain-/DB-Modelle werden in transportfähige DTOs umgewandelt.
    let rows = list_projects(&db_conn).map_err(ApiError::from)?;
    Ok(rows
        .into_iter()
        .map(|p| ProjectDto {
            id: p.id,
            name: p.name,
            path: p.path,
        })
        .collect())
}

/// Gibt das aktuell aktive Projekt zurück (ohne DB-Pfad-Lookup).
#[tauri::command]
pub fn get_active_project(state: State<TrackingState>) -> Option<ProjectDto> {
    // Optionaler Read-Only-Zugriff: Bei Lock-Fehler oder None wird None geliefert.
    let active = state.active_project.lock().ok()?;
    let (id, name) = active.as_ref()?;
    Some(ProjectDto {
        id: *id,
        name: name.clone(),
        // Der Pfad wird hier nicht aus der DB geladen, daher leer.
        path: String::new(),
    })
}

/// Setzt ein bestehendes Projekt anhand der ID als aktiv (z. B. aus der Projektliste).
#[tauri::command]
pub fn set_active_project(
    state: State<TrackingState>,
    project_id: i64,
) -> Result<ProjectDto, ApiError> {
    // DB-Lock für den Lookup des gewünschten Projekts.
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    // Projekt per ID laden und einen klaren Not-Found-Fehler liefern.
    let project = get_project_by_id(&db_conn, project_id)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::new("PROJECT_NOT_FOUND", "Projekt nicht gefunden"))?;

    // Lock-Reihenfolge sauber halten: DB erst freigeben, dann State locken.
    drop(db_conn);

    // Aktives Projekt zentral im TrackingState setzen.
    let mut active = state
        .active_project
        .lock()
        .map_err(|_| ApiError::new("LOCK_POISONED", "Projekt-Lock fehlgeschlagen"))?;
    *active = Some((project.id, project.name.clone()));
    // Rückgabe an das Frontend zur direkten UI-Aktualisierung.
    Ok(ProjectDto {
        id: project.id,
        name: project.name,
        path: project.path,
    })
}

/// Löscht ein Projekt samt zugehöriger Aktivitäten anhand der ID.
/// War das gelöschte Projekt aktiv, wird der aktive Zustand zurückgesetzt und das Tracking gestoppt.
#[tauri::command]
pub fn delete_project(state: State<TrackingState>, project_id: i64) -> Result<(), ApiError> {
    // DB-Lock für die Löschung des Projekts und seiner Aktivitäten.
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    delete_project_db(&db_conn, project_id).map_err(ApiError::from)?;

    // DB-Lock früh freigeben, bevor der State-Lock angefordert wird.
    drop(db_conn);

    // Falls das gelöschte Projekt aktiv war, aktiven Zustand zurücksetzen.
    let mut cleared_active = false;
    if let Ok(mut active) = state.active_project.lock() {
        if active.as_ref().map(|(id, _)| *id) == Some(project_id) {
            *active = None;
            cleared_active = true;
        }
    }

    // Ohne aktives Projekt ergibt weiteres Tracking keinen Sinn.
    if cleared_active {
        stop_tracking_internal(&state);
    }

    Ok(())
}
