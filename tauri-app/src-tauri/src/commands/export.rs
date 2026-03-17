use std::path::PathBuf;

use chrono::{Local, TimeZone, Utc};
use tauri::State;

use crate::dto::export::{ExportActivity, ExportMeta, ExportPayload};
use crate::error::ApiError;
use rustime_core::models::WindowActivity;
use rustime_db::get_all_activities;
use rustime_tracking::{current_timestamp, TrackingState};

// wandelt eine WindowActivity in eine ExportActivity um und fügt die timestamp_utc und timestamp_local hinzu
fn to_export_activity(a: WindowActivity) -> ExportActivity {
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
        }
    }

fn build_payload(activities: Vec<WindowActivity>) -> ExportPayload {
    let export_activities: Vec<ExportActivity> =
        activities.into_iter().map(to_export_activity).collect();

    ExportPayload {
        meta: ExportMeta {
            format_version: 1,
            exported_at_unix: current_timestamp(),
            entry_count: export_activities.len(),
            timezone: Local::now().offset().to_string(),
        },
        activities: export_activities,
    }
}

// gibt json-string in der UI zurück und speichert keine datei lokal
// liest alle activities aus der database und wandelt sie in eine ExportPayload um
#[tauri::command]
pub fn show_activities_json(state: State<TrackingState>) -> Result<String, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;
    let activities = get_all_activities(&db_conn).map_err(ApiError::from)?;
    let payload = build_payload(activities);

    serde_json::to_string(&payload)
        .map_err(|e| ApiError::new("JSON_SERIALIZE_FAILED", e.to_string()))
}


#[tauri::command]
pub fn export_activities_json_to_downloads(state: State<TrackingState>) -> Result<String, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let activities = get_all_activities(&db_conn).map_err(ApiError::from)?;
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