//! Export-Commands: Aktivitäten als JSON für Vorschau oder Datei im Download-Ordner.

use std::path::PathBuf;

use chrono::{Local, TimeZone, Utc};
use tauri::State;

use crate::dto::export::{ExportActivity, ExportMeta, ExportPayload};
use crate::error::ApiError;
use rustime_db::{get_activities_with_projects, ActivityWithProject};
use rustime_tracking::{current_timestamp, TrackingState};

/// Reichert eine DB-Zeile mit ISO-Zeitstempeln (UTC und lokal) für den Export an.
fn to_export_activity(a: ActivityWithProject) -> ExportActivity {
    let ts = a.timestamp as i64;

    let iso_utc = Utc
        .timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();

    let iso_local = Local
        .timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();

    ExportActivity {
        title: a.title,
        timestamp: a.timestamp,
        timestamp_utc: iso_utc,
        timestamp_local: iso_local,
        project_id: a.project_id,
        project_name: a.project_name,
    }
}

/// Baut die Export-Struktur inkl. Meta-Block (Formatversion, Zeitzone, Anzahl Einträge).
fn build_payload(activities: Vec<ActivityWithProject>) -> ExportPayload {
    let export_activities: Vec<ExportActivity> =
        activities.into_iter().map(to_export_activity).collect();

    ExportPayload {
        meta: ExportMeta {
            format_version: 2,
            exported_at_unix: current_timestamp(),
            entry_count: export_activities.len(),
            timezone: Local::now().offset().to_string(),
        },
        activities: export_activities,
    }
}

/// Serialisiert alle Aktivitäten als JSON-String für die UI-Vorschau (keine Datei).
#[tauri::command]
pub fn show_activities_json(state: State<TrackingState>) -> Result<String, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;
    let activities = get_activities_with_projects(&db_conn).map_err(ApiError::from)?;
    let payload = build_payload(activities);

    serde_json::to_string(&payload)
        .map_err(|e| ApiError::new("JSON_SERIALIZE_FAILED", e.to_string()))
}

/// Schreibt einen formatierten JSON-Export in den Download-Ordner; gibt den Dateipfad zurück.
#[tauri::command]
pub fn export_activities_json_to_downloads(
    state: State<TrackingState>,
) -> Result<String, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let activities = get_activities_with_projects(&db_conn).map_err(ApiError::from)?;
    let payload = build_payload(activities);

    let download_dir: PathBuf = dirs::download_dir()
        .ok_or_else(|| ApiError::new("DOWNLOAD_DIR_NOT_FOUND", "Download-Ordner nicht gefunden"))?;

    let file_name = format!("rustime-export-{}.json", current_timestamp());
    let out_path = download_dir.join(file_name);

    let pretty = serde_json::to_string_pretty(&payload)
        .map_err(|e| ApiError::new("JSON_SERIALIZE_FAILED", e.to_string()))?;

    std::fs::write(&out_path, pretty)
        .map_err(|e| ApiError::new("EXPORT_WRITE_FAILED", e.to_string()))?;

    Ok(out_path.to_string_lossy().to_string())
}
