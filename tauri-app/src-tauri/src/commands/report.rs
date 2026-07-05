//! Gemeinsame Berichts-Logik für Tages- und Wochenberichte (Dwell-Aggregation).

use std::collections::HashMap;

use chrono::{Local, TimeZone};
use tauri::State;

use crate::dto::stats::{
    CategoryTimeSeriesPointDto, CategoryValueDto, DailyReportDto, DwellSegmentDto,
    WeeklyReportDto,
};
use crate::error::ApiError;
use rustime_core::{classify_activity_type, ActivityType};
use rustime_db::{
    dwell_by_category_in_range, dwell_time_series_by_category,
    get_activities_filtered, get_activities_for_project_in_range, ActivitiesFilter,
    ActivityWithProject, DwellOptions, TimeSeriesOptions,
};
use rustime_tracking::TrackingState;

pub const SECONDS_PER_DAY: u64 = 86_400;
pub const DEFAULT_GAP_SECS: u64 = 120;
pub const DEFAULT_TAIL_SECS: u64 = 2;

#[derive(Debug, Clone, Copy)]
pub struct DwellParams {
    pub gap: u64,
    pub tail: u64,
}

impl DwellParams {
    pub fn from_options(max_segment_gap_seconds: Option<u64>, tail_seconds: Option<u64>) -> Self {
        Self {
            gap: max_segment_gap_seconds.unwrap_or(DEFAULT_GAP_SECS),
            tail: tail_seconds.unwrap_or(DEFAULT_TAIL_SECS),
        }
    }

    fn dwell_opts(&self, top_n: usize) -> DwellOptions {
        DwellOptions {
            max_segment_gap_seconds: self.gap,
            tail_seconds: self.tail,
            top_n,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PeriodBuildParams {
    pub range_start: u64,
    pub range_end_exclusive: u64,
    pub timeline_bucket_seconds: u64,
    pub dwell: DwellParams,
}

/// Gemeinsamer Kern beider Berichtstypen (KPIs, Kategorien, Zeitverlauf).
pub struct PeriodReportCore {
    pub project_name: Option<String>,
    pub total_active_seconds: u64,
    pub context_count: i64,
    pub first_activity_ts: Option<u64>,
    pub last_activity_ts: Option<u64>,
    pub by_category: Vec<DwellSegmentDto>,
    pub by_activity_type: Vec<DwellSegmentDto>,
    pub timeline: Vec<CategoryTimeSeriesPointDto>,
}

pub fn day_start_from_ts(ts: u64) -> u64 {
    let ts = ts as i64;
    Local
        .timestamp_opt(ts, 0)
        .single()
        .and_then(|dt| {
            dt.date_naive()
                .and_hms_opt(0, 0, 0)
                .and_then(|ndt| ndt.and_local_timezone(Local).single())
        })
        .map(|ldt| ldt.timestamp() as u64)
        .unwrap_or(ts as u64)
}

pub fn day_end_exclusive(day_start_ts: u64) -> u64 {
    day_start_ts.saturating_add(SECONDS_PER_DAY)
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

fn count_distinct_contexts(segments: &[DwellSegmentDto]) -> i64 {
    segments
        .iter()
        .filter(|s| s.name != "Sonstige" && s.value > 0)
        .count() as i64
}

/// Aggregiert die geschätzte aktive Zeit pro Tätigkeitsklasse.
fn compute_by_activity_type(
    rows: &[ActivityWithProject],
    range_start: u64,
    range_end: u64,
    dwell: DwellParams,
) -> Vec<DwellSegmentDto> {
    let mut by_type: HashMap<ActivityType, Vec<ActivityWithProject>> = HashMap::new();

    for row in rows {
        let activity_type = classify_activity_type(&row.title);
        by_type.entry(activity_type).or_default().push(row.clone());
    }

    let mut result: Vec<DwellSegmentDto> = ActivityType::all()
        .iter()
        .filter_map(|&at| {
            let type_rows = by_type.get(&at)?;
            let segments =
                dwell_by_category_in_range(type_rows, dwell.dwell_opts(0), range_start, range_end);
            let total: u64 = segments.iter().map(|s| s.value_seconds).sum();
            if total == 0 {
                return None;
            }
            Some(DwellSegmentDto {
                name: at.label().to_string(),
                value: total,
            })
        })
        .collect();

    result.sort_by(|a, b| b.value.cmp(&a.value));
    result
}

pub fn build_period_report_core(
    rows: &[ActivityWithProject],
    params: &PeriodBuildParams,
) -> PeriodReportCore {
    let range_start = params.range_start;
    let range_end = params.range_end_exclusive;
    let dwell = params.dwell;

    let by_category = map_dwell_segments(dwell_by_category_in_range(
        rows,
        dwell.dwell_opts(10),
        range_start,
        range_end,
    ));
    let by_activity_type = compute_by_activity_type(rows, range_start, range_end, dwell);
    let all_segments = dwell_by_category_in_range(
        rows,
        dwell.dwell_opts(0),
        range_start,
        range_end,
    );
    let total_active_seconds: u64 = all_segments.iter().map(|s| s.value_seconds).sum();
    let context_count = count_distinct_contexts(&map_dwell_segments(all_segments));

    let timeline = dwell_time_series_by_category(
        rows,
        TimeSeriesOptions {
            from_ts: range_start,
            to_ts: range_end,
            bucket_seconds: params.timeline_bucket_seconds.max(60),
            max_segment_gap_seconds: dwell.gap,
            tail_seconds: dwell.tail,
            align_to_range_start: true,
        },
    );

    PeriodReportCore {
        project_name: None,
        total_active_seconds,
        context_count,
        first_activity_ts: rows.first().map(|r| r.timestamp),
        last_activity_ts: rows.last().map(|r| r.timestamp),
        by_category,
        by_activity_type,
        timeline: map_time_series_points(timeline),
    }
}

/// Aktive Zeit pro Projekt über einen Zeitraum (alle Projekte, z. B. Tages-/Wochenübersicht).
pub fn compute_by_project_for_range(
    rows: &[ActivityWithProject],
    range_start: u64,
    range_end_exclusive: u64,
    dwell: DwellParams,
) -> Vec<DwellSegmentDto> {
    let mut by_project: HashMap<Option<i64>, Vec<ActivityWithProject>> = HashMap::new();
    for row in rows {
        by_project
            .entry(row.project_id)
            .or_default()
            .push(row.clone());
    }

    let mut out: Vec<DwellSegmentDto> = by_project
        .into_iter()
        .filter_map(|(_, project_rows)| {
            let name = project_rows
                .first()
                .and_then(|r| r.project_name.clone())
                .unwrap_or_else(|| "Ohne Projekt".to_string());

            let segments = dwell_by_category_in_range(
                &project_rows,
                dwell.dwell_opts(0),
                range_start,
                range_end_exclusive,
            );
            let total: u64 = segments.iter().map(|s| s.value_seconds).sum();
            if total == 0 {
                None
            } else {
                Some(DwellSegmentDto { name, value: total })
            }
        })
        .collect();

    out.sort_by(|a, b| b.value.cmp(&a.value).then_with(|| a.name.cmp(&b.name)));
    out
}

/// Aktive Zeit pro Kalendertag für ein Projekt (Wochenbericht).
pub fn compute_by_day(
    rows: &[ActivityWithProject],
    day_starts: &[u64],
    dwell: DwellParams,
) -> Vec<DwellSegmentDto> {
    let mut out: Vec<DwellSegmentDto> = day_starts
        .iter()
        .filter_map(|&day_start| {
            let day_end = day_end_exclusive(day_start);
            let segments = dwell_by_category_in_range(
                rows,
                dwell.dwell_opts(0),
                day_start,
                day_end,
            );
            let total: u64 = segments.iter().map(|s| s.value_seconds).sum();
            if total == 0 {
                None
            } else {
                Some(DwellSegmentDto {
                    name: format_iso_date_local(day_start),
                    value: total,
                })
            }
        })
        .collect();

    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

pub fn format_iso_date_local(ts: u64) -> String {
    let ts = ts as i64;
    Local
        .timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

pub fn resolve_project_name(
    rows: &[ActivityWithProject],
    fallback_name: Option<String>,
) -> Option<String> {
    rows.first()
        .and_then(|r| r.project_name.clone())
        .or(fallback_name)
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
    let dwell = DwellParams::from_options(max_segment_gap_seconds, tail_seconds);
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_for_project_in_range(&db_conn, project_id, from_ts, to_ts)
        .map_err(ApiError::from)?;

    let range_start = from_ts;
    let range_end_exclusive = day_end_exclusive(from_ts);

    let mut core = build_period_report_core(
        &rows,
        &PeriodBuildParams {
            range_start,
            range_end_exclusive,
            timeline_bucket_seconds: 900,
            dwell,
        },
    );
    let fallback_name = rustime_db::get_project_by_id(&db_conn, project_id)
        .ok()
        .flatten()
        .map(|p| p.name);
    core.project_name = resolve_project_name(&rows, fallback_name);

    let day_filter = ActivitiesFilter {
        project_id: None,
        from_ts: Some(from_ts),
        to_ts: Some(to_ts),
        context_query: None,
    };
    let all_day_rows = get_activities_filtered(&db_conn, &day_filter).map_err(ApiError::from)?;
    let by_project_day =
        compute_by_project_for_range(&all_day_rows, range_start, range_end_exclusive, dwell);

    Ok(DailyReportDto {
        date,
        project_name: core.project_name,
        total_active_seconds: core.total_active_seconds,
        context_count: core.context_count,
        first_activity_ts: core.first_activity_ts,
        last_activity_ts: core.last_activity_ts,
        by_category: core.by_category,
        by_activity_type: core.by_activity_type,
        by_project_day,
        timeline: core.timeline,
    })
}

/// Aggregierter Wochenbericht für ein Projekt (Mo–So, KPIs, Tagesverlauf).
#[tauri::command]
pub fn get_weekly_report(
    state: State<TrackingState>,
    project_id: i64,
    week_start: String,
    week_end: String,
    from_ts: u64,
    to_ts: u64,
    max_segment_gap_seconds: Option<u64>,
    tail_seconds: Option<u64>,
) -> Result<WeeklyReportDto, ApiError> {
    let dwell = DwellParams::from_options(max_segment_gap_seconds, tail_seconds);
    let db_conn = state
        .db
        .lock()
        .map_err(|_| ApiError::new("DB_LOCK_FAILED", "Datenbank-Lock fehlgeschlagen"))?;

    let rows = get_activities_for_project_in_range(&db_conn, project_id, from_ts, to_ts)
        .map_err(ApiError::from)?;

    let range_start = from_ts;
    let range_end_exclusive = day_end_exclusive(day_start_from_ts(to_ts));

    let mut core = build_period_report_core(
        &rows,
        &PeriodBuildParams {
            range_start,
            range_end_exclusive,
            timeline_bucket_seconds: SECONDS_PER_DAY,
            dwell,
        },
    );
    let fallback_name = rustime_db::get_project_by_id(&db_conn, project_id)
        .ok()
        .flatten()
        .map(|p| p.name);
    core.project_name = resolve_project_name(&rows, fallback_name);

    let mut day_starts = Vec::new();
    let mut cursor = range_start;
    while cursor < range_end_exclusive {
        day_starts.push(cursor);
        cursor = cursor.saturating_add(SECONDS_PER_DAY);
    }
    let by_day = compute_by_day(&rows, &day_starts, dwell);

    let week_filter = ActivitiesFilter {
        project_id: None,
        from_ts: Some(from_ts),
        to_ts: Some(to_ts),
        context_query: None,
    };
    let all_week_rows = get_activities_filtered(&db_conn, &week_filter).map_err(ApiError::from)?;
    let by_project_week =
        compute_by_project_for_range(&all_week_rows, range_start, range_end_exclusive, dwell);

    let active_days = by_day.len() as i64;

    Ok(WeeklyReportDto {
        week_start,
        week_end,
        project_name: core.project_name,
        total_active_seconds: core.total_active_seconds,
        context_count: core.context_count,
        active_days,
        first_activity_ts: core.first_activity_ts,
        last_activity_ts: core.last_activity_ts,
        by_category: core.by_category,
        by_activity_type: core.by_activity_type,
        by_day,
        by_project_week,
        timeline: core.timeline,
    })
}
