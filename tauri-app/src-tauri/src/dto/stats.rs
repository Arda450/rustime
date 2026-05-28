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
