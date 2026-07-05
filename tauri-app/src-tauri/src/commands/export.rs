//! Export-Commands: Rohdaten und aggregierte Verweildauer als JSON/CSV.
//!
//! Filter entsprechen der Aktivitätstabelle (`ActivitiesFilter`).
//! Aggregation nutzt dieselbe Dwell-Logik wie Charts/Tagesbericht.

use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{Local, TimeZone, Utc};
use tauri::State;

use crate::dto::export::{
    ExportActivity, ExportAggregated, ExportAggregatedActivityTypeRow,
    ExportAggregatedCategoryRow, ExportAggregatedProjectRow, ExportCsvResultDto, ExportMeta,
    ExportPayload,
};
use crate::error::ApiError;

use rustime_core::{classify_activity_type, format_context_label_from_title, ActivityType};
use rustime_db::{
    dwell_by_category, dwell_by_category_in_range, get_activities_filtered, ActivitiesFilter,
    ActivityWithProject, DwellOptions, DwellSegment,
};
use rustime_tracking::{current_timestamp, TrackingState};

const DWELL_GAP_SECS: u64 = 120;
const DWELL_TAIL_SECS: u64 = 2;

#[derive(Debug, Clone)]
struct ExportRequest {
    filter: ActivitiesFilter,
}

impl ExportRequest {
    fn from_params(
        project_id: Option<i64>,
        from_ts: Option<u64>,
        to_ts: Option<u64>,
        context_query: Option<String>,
    ) -> Self {
        Self {
            filter: ActivitiesFilter {
                project_id,
                from_ts,
                to_ts,
                context_query,
            },
        }
    }
}

fn to_export_activity(a: ActivityWithProject) -> ExportActivity {
    let ts = a.timestamp as i64;
    let context_label = format_context_label_from_title(&a.title);
    let activity_type = classify_activity_type(&a.title).label().to_string();

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
        context_label,
        activity_type,
        timestamp: a.timestamp,
        timestamp_utc: iso_utc,
        timestamp_local: iso_local,
        project_id: a.project_id,
        project_name: a.project_name,
    }
}

fn dwell_segments_for_rows(
    rows: &[ActivityWithProject],
    from_ts: Option<u64>,
    to_ts: Option<u64>,
) -> Vec<DwellSegment> {
    if rows.is_empty() {
        return Vec::new();
    }

    let opts = DwellOptions {
        max_segment_gap_seconds: DWELL_GAP_SECS,
        tail_seconds: DWELL_TAIL_SECS,
        top_n: 0,
    };

    match (from_ts, to_ts) {
        (Some(from), Some(to)) if to > from => dwell_by_category_in_range(rows, opts, from, to),
        _ => dwell_by_category(rows, opts),
    }
}

fn compute_aggregated(rows: &[ActivityWithProject], filter: &ActivitiesFilter) -> ExportAggregated {
    let mut by_project: HashMap<Option<i64>, Vec<ActivityWithProject>> = HashMap::new();

    for row in rows {
        by_project
            .entry(row.project_id)
            .or_default()
            .push(row.clone());
    }

    let mut by_project_category: Vec<ExportAggregatedCategoryRow> = Vec::new();

    for (project_id, project_rows) in by_project {
        let project_name = project_rows
            .first()
            .and_then(|r| r.project_name.clone());

        let segments = dwell_segments_for_rows(&project_rows, filter.from_ts, filter.to_ts);

        for seg in segments {
            if seg.value_seconds == 0 {
                continue;
            }
            by_project_category.push(ExportAggregatedCategoryRow {
                project_id,
                project_name: project_name.clone(),
                category: seg.name,
                active_seconds: seg.value_seconds,
            });
        }
    }

    by_project_category.sort_by(|a, b| {
        b.active_seconds
            .cmp(&a.active_seconds)
            .then_with(|| {
                a.project_name
                    .cmp(&b.project_name)
                    .then_with(|| a.category.cmp(&b.category))
            })
    });

    let mut project_totals: HashMap<Option<i64>, (Option<String>, u64)> = HashMap::new();
    for row in &by_project_category {
        let entry = project_totals
            .entry(row.project_id)
            .or_insert((row.project_name.clone(), 0));
        entry.1 = entry.1.saturating_add(row.active_seconds);
    }

    let mut by_project_summary: Vec<ExportAggregatedProjectRow> = project_totals
        .into_iter()
        .map(|(project_id, (project_name, active_seconds))| ExportAggregatedProjectRow {
            project_id,
            project_name,
            active_seconds,
        })
        .collect();

    by_project_summary.sort_by(|a, b| {
        b.active_seconds
            .cmp(&a.active_seconds)
            .then_with(|| a.project_name.cmp(&b.project_name))
    });

    let by_activity_type = compute_by_activity_type(rows, filter);

    ExportAggregated {
        by_project_category,
        by_project: by_project_summary,
        by_activity_type,
    }
}

/// Aggregiert die geschätzte aktive Zeit pro Tätigkeitsklasse.
fn compute_by_activity_type(
    rows: &[ActivityWithProject],
    filter: &ActivitiesFilter,
) -> Vec<ExportAggregatedActivityTypeRow> {
    let mut by_type: HashMap<ActivityType, Vec<ActivityWithProject>> = HashMap::new();

    for row in rows {
        let activity_type = classify_activity_type(&row.title);
        by_type.entry(activity_type).or_default().push(row.clone());
    }

    let mut result: Vec<ExportAggregatedActivityTypeRow> = ActivityType::all()
        .iter()
        .filter_map(|&at| {
            let type_rows = by_type.get(&at)?;
            let segments = dwell_segments_for_rows(type_rows, filter.from_ts, filter.to_ts);
            let total: u64 = segments.iter().map(|s| s.value_seconds).sum();
            if total == 0 {
                return None;
            }
            Some(ExportAggregatedActivityTypeRow {
                activity_type: at.label().to_string(),
                active_seconds: total,
            })
        })
        .collect();

    result.sort_by(|a, b| b.active_seconds.cmp(&a.active_seconds));
    result
}

fn build_payload(rows: Vec<ActivityWithProject>, req: &ExportRequest) -> ExportPayload {
    let aggregated = compute_aggregated(&rows, &req.filter);
    let export_activities: Vec<ExportActivity> = rows.into_iter().map(to_export_activity).collect();
    let sample_count = export_activities.len();
    let aggregated_count = aggregated.by_project_category.len();

    ExportPayload {
        meta: ExportMeta {
            format_version: 3,
            exported_at_unix: current_timestamp(),
            sample_count,
            aggregated_count,
            timezone: Local::now().offset().to_string(),
            filter_project_id: req.filter.project_id,
            filter_from_ts: req.filter.from_ts,
            filter_to_ts: req.filter.to_ts,
            filter_context_query: req.filter.context_query.clone(),
        },
        activities: export_activities,
        aggregated,
    }
}

fn load_filtered_activities(
    state: &State<TrackingState>,
    req: &ExportRequest,
) -> Result<Vec<ActivityWithProject>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;
    get_activities_filtered(&db_conn, &req.filter).map_err(ApiError::from)
}

fn download_dir() -> Result<PathBuf, ApiError> {
    dirs::download_dir()
        .ok_or_else(|| ApiError::new("DOWNLOAD_DIR_NOT_FOUND", "Download-Ordner nicht gefunden"))
}

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

fn format_duration_hms(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;
    if hours > 0 {
        format!("{hours} h {minutes} min {secs} s")
    } else if minutes > 0 {
        format!("{minutes} min {secs} s")
    } else {
        format!("{secs} s")
    }
}

fn build_samples_csv(activities: &[ExportActivity]) -> String {
    let mut lines = Vec::with_capacity(activities.len() + 1);
    lines.push(
        "datum;uhrzeit;kontext;taetigkeitsklasse;fenstertitel;projekt;projekt_id;timestamp_unix"
            .to_string(),
    );

    for a in activities {
        let project_name = a.project_name.as_deref().unwrap_or("");
        let project_id = a
            .project_id
            .map(|id| id.to_string())
            .unwrap_or_default();

        lines.push(format!(
            "{};{};{};{};{};{};{};{}",
            escape_csv_field(&format_date_local(a.timestamp)),
            escape_csv_field(&format_time_local(a.timestamp)),
            escape_csv_field(&a.context_label),
            escape_csv_field(&a.activity_type),
            escape_csv_field(&a.title),
            escape_csv_field(project_name),
            escape_csv_field(&project_id),
            a.timestamp,
        ));
    }

    lines.join("\n")
}

fn build_aggregated_csv(aggregated: &ExportAggregated) -> String {
    let mut lines = vec![
        "projekt;projekt_id;kategorie;aktiv_sekunden;aktiv_lesbar".to_string(),
    ];

    for row in &aggregated.by_project_category {
        let project_name = row.project_name.as_deref().unwrap_or("");
        let project_id = row
            .project_id
            .map(|id| id.to_string())
            .unwrap_or_default();

        lines.push(format!(
            "{};{};{};{};{}",
            escape_csv_field(project_name),
            escape_csv_field(&project_id),
            escape_csv_field(&row.category),
            row.active_seconds,
            escape_csv_field(&format_duration_hms(row.active_seconds)),
        ));
    }

    lines.push(String::new());
    lines.push("projekt;projekt_id;gesamt_aktiv_sekunden;gesamt_lesbar".to_string());

    for row in &aggregated.by_project {
        let project_name = row.project_name.as_deref().unwrap_or("");
        let project_id = row
            .project_id
            .map(|id| id.to_string())
            .unwrap_or_default();

        lines.push(format!(
            "{};{};{};{}",
            escape_csv_field(project_name),
            escape_csv_field(&project_id),
            row.active_seconds,
            escape_csv_field(&format_duration_hms(row.active_seconds)),
        ));
    }

    lines.push(String::new());
    lines.push("taetigkeitsklasse;aktiv_sekunden;aktiv_lesbar".to_string());

    for row in &aggregated.by_activity_type {
        lines.push(format!(
            "{};{};{}",
            escape_csv_field(&row.activity_type),
            row.active_seconds,
            escape_csv_field(&format_duration_hms(row.active_seconds)),
        ));
    }

    lines.join("\n")
}

fn write_csv_with_bom(path: &PathBuf, csv: &str) -> Result<(), ApiError> {
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(csv.as_bytes());
    std::fs::write(path, bytes).map_err(|e| ApiError::new("EXPORT_WRITE_FAILED", e.to_string()))
}

fn export_params(
    project_id: Option<i64>,
    from_ts: Option<u64>,
    to_ts: Option<u64>,
    context_query: Option<String>,
) -> ExportRequest {
    ExportRequest::from_params(project_id, from_ts, to_ts, context_query)
}

#[tauri::command]
pub fn show_activities_json(
    state: State<TrackingState>,
    project_id: Option<i64>,
    from_ts: Option<u64>,
    to_ts: Option<u64>,
    context_query: Option<String>,
) -> Result<String, ApiError> {
    let req = export_params(project_id, from_ts, to_ts, context_query);
    let rows = load_filtered_activities(&state, &req)?;
    let payload = build_payload(rows, &req);

    serde_json::to_string(&payload)
        .map_err(|e| ApiError::new("JSON_SERIALIZE_FAILED", e.to_string()))
}

#[tauri::command]
pub fn export_activities_json_to_downloads(
    state: State<TrackingState>,
    project_id: Option<i64>,
    from_ts: Option<u64>,
    to_ts: Option<u64>,
    context_query: Option<String>,
) -> Result<String, ApiError> {
    let req = export_params(project_id, from_ts, to_ts, context_query);
    let rows = load_filtered_activities(&state, &req)?;
    let payload = build_payload(rows, &req);

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
    project_id: Option<i64>,
    from_ts: Option<u64>,
    to_ts: Option<u64>,
    context_query: Option<String>,
) -> Result<ExportCsvResultDto, ApiError> {
    let req = export_params(project_id, from_ts, to_ts, context_query);
    let rows = load_filtered_activities(&state, &req)?;
    let payload = build_payload(rows, &req);

    let ts = current_timestamp();
    let samples_path = download_dir()?.join(format!("rustime-samples-{ts}.csv"));
    let aggregated_path = download_dir()?.join(format!("rustime-aggregated-{ts}.csv"));

    let mut samples = payload.activities;
    samples.sort_by_key(|a| a.timestamp);

    write_csv_with_bom(&samples_path, &build_samples_csv(&samples))?;
    write_csv_with_bom(&aggregated_path, &build_aggregated_csv(&payload.aggregated))?;

    Ok(ExportCsvResultDto {
        samples_path: samples_path.to_string_lossy().to_string(),
        aggregated_path: aggregated_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn export_report_pdf_to_downloads(pdf_bytes: Vec<u8>) -> Result<String, ApiError> {
    if pdf_bytes.is_empty() {
        return Err(ApiError::new(
            "EXPORT_EMPTY_PDF",
            "PDF-Export enthält keine Daten.",
        ));
    }

    let file_name = format!("rustime-bericht-{}.pdf", current_timestamp());
    let out_path = download_dir()?.join(file_name);

    std::fs::write(&out_path, pdf_bytes)
        .map_err(|e| ApiError::new("EXPORT_WRITE_FAILED", e.to_string()))?;

    Ok(out_path.to_string_lossy().to_string())
}
