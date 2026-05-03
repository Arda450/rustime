use std::path::Path;
use tauri::State;

use crate::dto::project::ProjectDto;
use crate::error::ApiError;
use rustime_db::{list_projects, upsert_project, get_project_by_id};
use rustime_tracking::{current_timestamp, TrackingState};

// Leitet aus einem Dateipfad einen sinnvollen Projektnamen ab.
// Falls kein Dateiname bestimmbar ist, wird der volle Pfad genutzt.
fn name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string()
}

#[tauri::command]
pub fn select_project_path(state: State<TrackingState>, path: String) -> Result<ProjectDto, ApiError> {
    // Name wird aus dem letzten Pfadsegment gebildet (z. B. Ordnername).
    let name = name_from_path(&path);

    // DB-Verbindung aus dem globalen State holen; Lock-Fehler sauber mappen.
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    // Projekt anlegen oder aktualisieren (Upsert), inkl. Zeitstempel.
    let project = upsert_project(&db_conn, &name, &path, current_timestamp()).map_err(ApiError::from)?;

    // DB-Lock früh freigeben, bevor der nächste Lock angefordert wird.
    drop(db_conn);

    // In-Memory-Status für das aktuell aktive Projekt aktualisieren.
    let mut active = state
        .active_project
        .lock()
        .map_err(|_| ApiError::new("LOCK_POISONED", "Projekt-Lock fehlgeschlagen"))?;
    *active = Some((project.id, project.name.clone()));

    // DTO ist die API-Antwort für das Frontend.
    Ok(ProjectDto { id: project.id, name: project.name, path: project.path })
}

#[tauri::command]
pub fn get_projects(state: State<TrackingState>) -> Result<Vec<ProjectDto>, ApiError> {
    // Lesender Zugriff auf die DB; Rückgabe aller bekannten Projekte.
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    // Domain-/DB-Modelle werden in transportfähige DTOs umgewandelt.
    let rows = list_projects(&db_conn).map_err(ApiError::from)?;
    Ok(rows.into_iter().map(|p| ProjectDto { id: p.id, name: p.name, path: p.path }).collect())
}

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
    Ok(ProjectDto { id: project.id, name: project.name, path: project.path })
}