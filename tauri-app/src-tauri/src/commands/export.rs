//! Export-Commands: Aktivitäten als JSON oder CSV für Vorschau bzw. Downloads.

use std::path::PathBuf;

use chrono::{Local, TimeZone, Utc};
use rustime_core::window_context::format_context_label_from_title;
use tauri::State;

use crate::dto::export::{ExportActivity, ExportMeta, ExportPayload};
use crate::error::ApiError;
use rustime_db::{get_activities_with_projects, ActivityWithProject};
use rustime_tracking::{current_timestamp, TrackingState};

fn to_export_activity(a: ActivityWithProject) -> ExportActivity {
    let ts = a.timestamp as i64;

    // erst wird a.title geliehen, danach moved zu title
    // a.title = ActivityWithProject.title wird unverändert geliehen (read)
    let context_label = format_context_label_from_title(&a.title);

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
        context_label, // leiht a.title vor dem moved zu title
        timestamp: a.timestamp,
        timestamp_utc: iso_utc,
        timestamp_local: iso_local,
        project_id: a.project_id,
        project_name: a.project_name,
    }
}

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

fn load_activities(state: &State<TrackingState>) -> Result<Vec<ActivityWithProject>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;
    get_activities_with_projects(&db_conn).map_err(ApiError::from)
}

fn download_dir() -> Result<PathBuf, ApiError> {
    dirs::download_dir()
        .ok_or_else(|| ApiError::new("DOWNLOAD_DIR_NOT_FOUND", "Download-Ordner nicht gefunden"))
}

/// Escaped ein Feld für CSV (; als Trennzeichen, Excel CH).
fn escape_csv_field(value: &str) -> String {
    if value.contains(';') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn format_date_local(ts: u64) -> String {
    let ts = ts as i64;
    Local
        .timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.format("%d.%m.%Y").to_string())
        .unwrap_or_default()
}

fn format_time_local(ts: u64) -> String {
    let ts = ts as i64;
    Local
        .timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.format("%H:%M:%S").to_string())
        .unwrap_or_default()
}

fn build_csv(activities: &[ExportActivity]) -> String {
    let mut lines = Vec::with_capacity(activities.len() + 1);
    lines.push(
        "datum;uhrzeit;kontext;fenstertitel;projekt;projekt_id;timestamp_unix".to_string(),
    );

    for a in activities {
        let project_name = a.project_name.as_deref().unwrap_or("");
        let project_id = a
            .project_id
            .map(|id| id.to_string())
            .unwrap_or_default();

        lines.push(format!(
            "{};{};{};{};{};{};{}",
            escape_csv_field(&format_date_local(a.timestamp)),
            escape_csv_field(&format_time_local(a.timestamp)),
            escape_csv_field(&a.context_label),
            escape_csv_field(&a.title),
            escape_csv_field(project_name),
            escape_csv_field(&project_id),
            a.timestamp,
        ));
    }

    lines.join("\n")
}

#[tauri::command]
pub fn show_activities_json(state: State<TrackingState>) -> Result<String, ApiError> {
    let activities = load_activities(&state)?;
    let payload = build_payload(activities);

    serde_json::to_string(&payload)
        .map_err(|e| ApiError::new("JSON_SERIALIZE_FAILED", e.to_string()))
}

#[tauri::command]
pub fn export_activities_json_to_downloads(
    state: State<TrackingState>,
) -> Result<String, ApiError> {
    let activities = load_activities(&state)?;
    let payload = build_payload(activities);

    let file_name = format!("rustime-export-{}.json", current_timestamp());
    let out_path = download_dir()?.join(file_name);

    let pretty = serde_json::to_string_pretty(&payload)
        .map_err(|e| ApiError::new("JSON_SERIALIZE_FAILED", e.to_string()))?;

    std::fs::write(&out_path, pretty)
        .map_err(|e| ApiError::new("EXPORT_WRITE_FAILED", e.to_string()))?;

    Ok(out_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_activities_csv_to_downloads(
    state: State<TrackingState>,
) -> Result<String, ApiError> {
    let activities = load_activities(&state)?;
    let mut rows: Vec<ExportActivity> = activities.into_iter().map(to_export_activity).collect();
    rows.sort_by_key(|a| a.timestamp);

    let csv = build_csv(&rows);
    let file_name = format!("rustime-export-{}.csv", current_timestamp());
    let out_path = download_dir()?.join(file_name);

    // UTF-8 BOM hilft Excel beim Öffnen (Umlaute)
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(csv.as_bytes());

    std::fs::write(&out_path, bytes)
        .map_err(|e| ApiError::new("EXPORT_WRITE_FAILED", e.to_string()))?;

    Ok(out_path.to_string_lossy().to_string())
}