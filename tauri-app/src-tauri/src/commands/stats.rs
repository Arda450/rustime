//! Statistik-Commands: Auswertungen und paginierte Aktivitäten für UI und Charts.
//!
//! Schwere Aggregation (Verweildauer, SQL-Paginierung) läuft hier im Backend,
//! nicht im React-Frontend.

use tauri::State;

use crate::dto::activity::ActivityDto;
use crate::dto::stats::{ActivitiesPageDto, DwellSegmentDto};
use crate::error::ApiError;
use rustime_db::{
    dwell_by_category, get_activities_for_project_asc,
    get_activities_page as db_get_activities_page, DwellOptions,
};
use rustime_tracking::TrackingState;

/// Mappt eine DB-Zeile auf das transportfähige `ActivityDto` für die UI.
/// die Felder werden an from_parts übergeben (move). 
fn row_to_dto(row: rustime_db::ActivityWithProject) -> ActivityDto {
    ActivityDto::from_parts(row.title, row.timestamp, row.project_id, row.project_name)
}

/// Aggregiert geschätzte Verweildauer pro Kategorie für ein Projekt (Pie-Chart).
/// Parameter optional; Defaults: Gap 120 s, Tail 2 s, Top 10 inkl. „Sonstige“.
#[tauri::command]
pub fn get_dwell_by_category(
    state: State<TrackingState>,
    project_id: i64,
    max_segment_gap_seconds: Option<u64>,
    tail_seconds: Option<u64>,
    top_n: Option<usize>,
) -> Result<Vec<DwellSegmentDto>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_for_project_asc(&db_conn, project_id).map_err(ApiError::from)?;

    let options = DwellOptions {
        max_segment_gap_seconds: max_segment_gap_seconds.unwrap_or(120),
        tail_seconds: tail_seconds.unwrap_or(2),
        top_n: top_n.unwrap_or(10),
    };

    let segments = dwell_by_category(&rows, options);

    Ok(segments
        .into_iter()
        .map(|s| DwellSegmentDto {
            name: s.name,
            value: s.value_seconds,
        })
        .collect())
}

/// Liefert eine Seite Aktivitäten (neueste zuerst), optional gefiltert nach `project_id`.
#[tauri::command]
pub fn get_activities_page(
    state: State<TrackingState>,
    project_id: Option<i64>,
    page: u32,
    page_size: u32,
) -> Result<ActivitiesPageDto, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let page_result =
        db_get_activities_page(&db_conn, project_id, page, page_size).map_err(ApiError::from)?;

    Ok(ActivitiesPageDto {
        items: page_result.items.into_iter().map(row_to_dto).collect(),
        total_count: page_result.total_count,
    })
}
