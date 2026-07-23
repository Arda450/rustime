//! Statistik-Commands: Auswertungen und paginierte Aktivitäten für UI und Charts.
//!
//! Schwere Aggregation (Verweildauer, SQL-Paginierung) läuft hier im Backend.
//! Tages- und Wochenberichte: `commands/report.rs`.

use chrono::{Local, TimeZone};
use tauri::State;

use crate::dto::activity::ActivityDto;
use crate::dto::stats::{
    ActivitiesPageDto, CategoryTimeSeriesPointDto, CategoryValueDto, DwellSegmentDto,
    OverviewStatsDto,
};
use crate::error::ApiError;
use rustime_db::{
    count_projects, dwell_by_category_in_range, dwell_time_series_by_category,
    dwell_time_series_by_project, get_activities_filtered,
    get_activities_page as db_get_activities_page, get_activity_overview_summary,
    get_project_activity_totals, ActivitiesFilter, DwellOptions, TimeSeriesOptions,
};
use rustime_tracking::TrackingState;

/// Mappt eine DB-Zeile auf das transportfähige `ActivityDto` für die UI.
fn row_to_dto(row: rustime_db::ActivityWithProject) -> ActivityDto {
    ActivityDto::from_parts(row.title, row.timestamp, row.project_id, row.project_name)
}

/// Liefert eine kompakte 24-Stunden-Gesamtstatistik aller Projekte.
///
/// Rohaktivitäten werden nur im Backend verarbeitet; an die UI gehen höchstens
/// zehn Projektsegmente und 96 Viertelstunden-Buckets.
#[tauri::command]
pub fn get_overview_stats(state: State<TrackingState>) -> Result<OverviewStatsDto, ApiError> {
    const RANGE_SECONDS: u64 = 24 * 60 * 60;
    const BUCKET_SECONDS: u64 = 15 * 60;

    let to_ts = rustime_tracking::current_timestamp();
    let from_ts = to_ts.saturating_sub(RANGE_SECONDS);
    let today_start_ts = Local::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .and_then(|value| Local.from_local_datetime(&value).single())
        .map(|value| value.timestamp().max(0) as u64)
        .unwrap_or(from_ts);
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;
    let rows = get_activities_filtered(
        &db_conn,
        &ActivitiesFilter {
            project_id: None,
            from_ts: Some(from_ts),
            to_ts: Some(to_ts),
            context_query: None,
        },
    )
    .map_err(ApiError::from)?;

    let summary =
        get_activity_overview_summary(&db_conn, today_start_ts).map_err(ApiError::from)?;
    let project_totals = get_project_activity_totals(&db_conn).map_err(ApiError::from)?;
    let mut by_project: Vec<DwellSegmentDto> = project_totals
        .iter()
        .take(10)
        .map(|project| DwellSegmentDto {
            name: project.name.clone(),
            value: project.active_seconds,
        })
        .collect();
    let remaining: u64 = project_totals
        .iter()
        .skip(10)
        .map(|project| project.active_seconds)
        .sum();
    if remaining > 0 {
        by_project.push(DwellSegmentDto {
            name: "Sonstige".to_string(),
            value: remaining,
        });
    }
    let timeline = dwell_time_series_by_project(
        &rows,
        TimeSeriesOptions {
            from_ts,
            to_ts,
            bucket_seconds: BUCKET_SECONDS,
            max_segment_gap_seconds: 120,
            tail_seconds: 2,
            align_to_range_start: true,
        },
    )
    .into_iter()
    .map(|point| CategoryTimeSeriesPointDto {
        ts: point.bucket_start_ts,
        categories: point
            .by_category
            .into_iter()
            .map(|(name, value)| CategoryValueDto { name, value })
            .collect(),
    })
    .collect();

    Ok(OverviewStatsDto {
        from_ts,
        to_ts,
        activity_count: summary.activity_count,
        project_count: count_projects(&db_conn).map_err(ApiError::from)?,
        total_active_seconds: summary.total_active_seconds,
        today_active_seconds: summary.today_active_seconds,
        active_days: summary.active_days,
        first_activity_ts: summary.first_activity_ts,
        by_project,
        timeline,
    })
}

/// Aggregiert geschätzte Verweildauer pro Kategorie für ein Projekt (Pie-Chart).
#[tauri::command]
pub fn get_dwell_by_category(
    state: State<TrackingState>,
    project_id: i64,
    from_ts: u64,
    to_ts: u64,
    max_segment_gap_seconds: Option<u64>,
    tail_seconds: Option<u64>,
    top_n: Option<usize>,
) -> Result<Vec<DwellSegmentDto>, ApiError> {
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_filtered(
        &db_conn,
        &ActivitiesFilter {
            project_id: Some(project_id),
            from_ts: Some(from_ts),
            to_ts: Some(to_ts),
            context_query: None,
        },
    )
    .map_err(ApiError::from)?;

    let options = DwellOptions {
        max_segment_gap_seconds: max_segment_gap_seconds.unwrap_or(120),
        tail_seconds: tail_seconds.unwrap_or(2),
        top_n: top_n.unwrap_or(10),
    };

    let segments = dwell_by_category_in_range(&rows, options, from_ts, to_ts);

    Ok(segments
        .into_iter()
        .map(|s| DwellSegmentDto {
            name: s.name,
            value: s.value_seconds,
        })
        .collect())
}

/// Liefert eine Seite Aktivitäten, serverseitig gefiltert, sortiert und paginiert.
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
        sort_by.unwrap_or_else(|| "date".to_string()),
        sort_order.unwrap_or_else(|| "desc".to_string()),
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

    let rows = get_activities_filtered(
        &db_conn,
        &ActivitiesFilter {
            project_id: Some(project_id),
            from_ts: Some(from_ts),
            to_ts: Some(to_ts),
            context_query: None,
        },
    )
    .map_err(ApiError::from)?;

    let options = TimeSeriesOptions {
        from_ts,
        to_ts,
        bucket_seconds: bucket_seconds.unwrap_or(900).max(60),
        max_segment_gap_seconds: max_segment_gap_seconds.unwrap_or(120),
        tail_seconds: tail_seconds.unwrap_or(2),
        align_to_range_start: false,
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
