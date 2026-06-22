//! Statistik-Commands: Auswertungen und paginierte Aktivitäten für UI und Charts.
//!
//! Schwere Aggregation (Verweildauer, SQL-Paginierung) läuft hier im Backend.

use tauri::State;

use crate::dto::activity::ActivityDto;
use crate::dto::stats::{
    ActivitiesPageDto, CategoryTimeSeriesPointDto, CategoryValueDto, DailyReportDto,
    DwellSegmentDto,
};
use crate::error::ApiError;
use rustime_db::{
    dwell_by_category, dwell_by_category_in_range, dwell_time_series_by_category,
    get_activities_for_project_asc, get_activities_for_project_in_range,
    get_activities_page as db_get_activities_page, ActivitiesFilter, DwellOptions,
    TimeSeriesOptions,
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

/// Liefert eine Seite Aktivitäten, serverseitig gefiltert, sortiert und paginiert.
///
/// Filter und Sortierung laufen in SQLite (`activity_repo.rs`), nicht im React-Frontend –
/// sonst würde nur die aktuelle Seite (z. B. 20 Zeilen) gefiltert/sortiert.
#[tauri::command]
pub fn get_activities_page(
    state: State<TrackingState>,
    project_id: Option<i64>,
    page: u32,
    page_size: u32,
    from_ts: Option<u64>,
    to_ts: Option<u64>,
    context_query: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<ActivitiesPageDto, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let filter = ActivitiesFilter {
        project_id,
        from_ts,
        to_ts,
        context_query,
    };

    let page_result = db_get_activities_page(
        &db_conn,
        &filter,
        page,
        page_size,
        sort_by.unwrap_or_else(|| "date".to_string()), // weiterleitung an die db
        sort_order.unwrap_or_else(|| "desc".to_string()), // fallback wird nur bei non berechnet (unwrap_or_else)
    )
    .map_err(ApiError::from)?;

    Ok(ActivitiesPageDto {
        items: page_result.items.into_iter().map(row_to_dto).collect(),
        total_count: page_result.total_count,
    })
}

/// Liefert Zeitverlauf pro Kategorie (für gestapelte Charts) für ein Projekt.
#[tauri::command]
pub fn get_time_series_by_category(
    state: State<TrackingState>,
    project_id: i64,
    from_ts: u64,
    to_ts: u64,
    bucket_seconds: Option<u64>,
    max_segment_gap_seconds: Option<u64>,
    tail_seconds: Option<u64>,
) -> Result<Vec<CategoryTimeSeriesPointDto>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_for_project_asc(&db_conn, project_id).map_err(ApiError::from)?;

    let options = TimeSeriesOptions {
        from_ts,
        to_ts,
        bucket_seconds: bucket_seconds.unwrap_or(900).max(60),
        max_segment_gap_seconds: max_segment_gap_seconds.unwrap_or(120),
        tail_seconds: tail_seconds.unwrap_or(2),
    };

    let points = dwell_time_series_by_category(&rows, options);
    Ok(points
        .into_iter()
        .map(|p| CategoryTimeSeriesPointDto {
            ts: p.bucket_start_ts,
            categories: p
                .by_category
                .into_iter()
                .map(|(name, value)| CategoryValueDto { name, value })
                .collect(),
        })
        .collect())
}

fn map_dwell_segments(segments: Vec<rustime_db::DwellSegment>) -> Vec<DwellSegmentDto> {
    segments
        .into_iter()
        .map(|s| DwellSegmentDto {
            name: s.name,
            value: s.value_seconds,
        })
        .collect()
}

fn map_time_series_points(
    points: Vec<rustime_db::CategoryTimeSeriesPoint>,
) -> Vec<CategoryTimeSeriesPointDto> {
    points
        .into_iter()
        .map(|p| CategoryTimeSeriesPointDto {
            ts: p.bucket_start_ts,
            categories: p
                .by_category
                .into_iter()
                .map(|(name, value)| CategoryValueDto { name, value })
                .collect(),
        })
        .collect()
}

/// Aggregierter Tagesbericht für ein Projekt (KPIs, Kategorien, Zeitverlauf).
#[tauri::command]
pub fn get_daily_report(
    state: State<TrackingState>,
    project_id: i64,
    date: String,
    from_ts: u64,
    to_ts: u64,
    max_segment_gap_seconds: Option<u64>,
    tail_seconds: Option<u64>,
) -> Result<DailyReportDto, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_for_project_in_range(&db_conn, project_id, from_ts, to_ts)
        .map_err(ApiError::from)?;

    let gap = max_segment_gap_seconds.unwrap_or(120);
    let tail = tail_seconds.unwrap_or(2);

    let dwell_opts = DwellOptions {
        max_segment_gap_seconds: gap,
        tail_seconds: tail,
        top_n: 10,
    };

    let top_opts = DwellOptions {
        max_segment_gap_seconds: gap,
        tail_seconds: tail,
        top_n: 5,
    };

    let timeline_to_ts = from_ts.saturating_add(86_400);
    let bucket_seconds = 900;

    let by_category = dwell_by_category_in_range(&rows, dwell_opts, from_ts, timeline_to_ts);
    let top_contexts = dwell_by_category_in_range(&rows, top_opts, from_ts, timeline_to_ts);
    let all_segments = dwell_by_category_in_range(
        &rows,
        DwellOptions {
            max_segment_gap_seconds: gap,
            tail_seconds: tail,
            top_n: 0,
        },
        from_ts,
        timeline_to_ts,
    );
    let total_active_seconds: u64 = all_segments.iter().map(|s| s.value_seconds).sum();

    let timeline = dwell_time_series_by_category(
        &rows,
        TimeSeriesOptions {
            from_ts,
            to_ts: timeline_to_ts,
            bucket_seconds,
            max_segment_gap_seconds: gap,
            tail_seconds: tail,
        },
    );

    let project_name = rows
        .first()
        .and_then(|r| r.project_name.clone())
        .or_else(|| {
            rustime_db::get_project_by_id(&db_conn, project_id)
                .ok()
                .flatten()
                .map(|p| p.name)
        });

    Ok(DailyReportDto {
        date,
        project_name,
        total_active_seconds,
        sample_count: rows.len() as i64,
        first_activity_ts: rows.first().map(|r| r.timestamp),
        last_activity_ts: rows.last().map(|r| r.timestamp),
        by_category: map_dwell_segments(by_category),
        timeline: map_time_series_points(timeline),
        top_contexts: map_dwell_segments(top_contexts),
    })
}
