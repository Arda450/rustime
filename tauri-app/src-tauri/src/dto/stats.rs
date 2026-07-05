//! DTOs für Auswertungen: Pie-Chart-Segmente und paginierte Aktivitäten-Seiten.

use serde::Serialize;

use super::activity::ActivityDto;

/// Ein Segment für Recharts (Name + Dauer in Sekunden als `value`).
#[derive(Serialize)]
pub struct DwellSegmentDto {
    pub name: String,
    pub value: u64,
}

/// Antwort von `get_activities_page`: aktuelle Seite plus Gesamtanzahl für Paginierung.
#[derive(Serialize)]
pub struct ActivitiesPageDto {
    pub items: Vec<ActivityDto>,
    pub total_count: i64,
}

/// Eine Kategorie mit Dauer in Sekunden für ein Zeitfenster.
#[derive(Serialize)]
pub struct CategoryValueDto {
    pub name: String,
    pub value: u64,
}

/// Ein Zeitfenster mit mehreren Kategorie-Werten (für gestapelte Charts).
#[derive(Serialize)]
pub struct CategoryTimeSeriesPointDto {
    pub ts: u64,
    pub categories: Vec<CategoryValueDto>,
}

/// Tagesbericht für ein Projekt an einem Kalendertag.
#[derive(Serialize)]
pub struct DailyReportDto {
    pub date: String,
    pub project_name: Option<String>,
    pub total_active_seconds: u64,
    pub context_count: i64,
    pub first_activity_ts: Option<u64>,
    pub last_activity_ts: Option<u64>,
    pub by_category: Vec<DwellSegmentDto>,
    /// Zeit pro Tätigkeitsklasse (Entwicklung, Kommunikation, etc.).
    pub by_activity_type: Vec<DwellSegmentDto>,
    pub by_project_day: Vec<DwellSegmentDto>,
    pub timeline: Vec<CategoryTimeSeriesPointDto>,
}

/// Wochenbericht für ein Projekt (Kalenderwoche Mo–So).
#[derive(Serialize)]
pub struct WeeklyReportDto {
    pub week_start: String,
    pub week_end: String,
    pub project_name: Option<String>,
    pub total_active_seconds: u64,
    pub context_count: i64,
    pub active_days: i64,
    pub first_activity_ts: Option<u64>,
    pub last_activity_ts: Option<u64>,
    pub by_category: Vec<DwellSegmentDto>,
    /// Zeit pro Tätigkeitsklasse (Entwicklung, Kommunikation, etc.).
    pub by_activity_type: Vec<DwellSegmentDto>,
    pub by_day: Vec<DwellSegmentDto>,
    pub by_project_week: Vec<DwellSegmentDto>,
    pub timeline: Vec<CategoryTimeSeriesPointDto>,
}
