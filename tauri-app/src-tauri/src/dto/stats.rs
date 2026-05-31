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

/// Ein Punkt im Zeitverlauf (Bucket-Start + Dauer in Sekunden).
#[derive(Serialize)]
pub struct TimeSeriesPointDto {
    pub ts: u64,
    pub value: u64,
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
