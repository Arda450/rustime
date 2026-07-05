//! DTOs für den JSON-/CSV-Export (Rohdaten + aggregierte Verweildauer).

use serde::Serialize;

/// Metadaten zum Export-Lauf (Versionierung, Zeitpunkt, Umfang).
#[derive(Serialize)]
pub struct ExportMeta {
    pub format_version: u32,
    pub exported_at_unix: u64,
    pub sample_count: usize,
    pub aggregated_count: usize,
    pub timezone: String,
    pub filter_project_id: Option<i64>,
    pub filter_from_ts: Option<u64>,
    pub filter_to_ts: Option<u64>,
    pub filter_context_query: Option<String>,
}

/// Eine exportierte Aktivität mit maschinen- und menschenlesbaren Zeitstempeln.
#[derive(Serialize)]
pub struct ExportActivity {
    pub title: String,
    pub context_label: String,
    /// Tätigkeitsklasse (Entwicklung, Kommunikation, Recherche, Organisation, Sonstiges).
    pub activity_type: String,
    pub timestamp: u64,
    pub timestamp_utc: String,
    pub timestamp_local: String,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
}

/// Geschätzte aktive Zeit pro Projekt und Kategorie.
#[derive(Serialize, Clone)]
pub struct ExportAggregatedCategoryRow {
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub category: String,
    pub active_seconds: u64,
}

/// Summe der geschätzten aktiven Zeit pro Projekt.
#[derive(Serialize, Clone)]
pub struct ExportAggregatedProjectRow {
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub active_seconds: u64,
}

/// Geschätzte aktive Zeit pro Tätigkeitsklasse (Entwicklung, Kommunikation, etc.).
#[derive(Serialize, Clone)]
pub struct ExportAggregatedActivityTypeRow {
    pub activity_type: String,
    pub active_seconds: u64,
}

#[derive(Serialize)]
pub struct ExportAggregated {
    /// Zeit pro Projekt und Kontext (Detail).
    pub by_project_category: Vec<ExportAggregatedCategoryRow>,
    /// Zeit pro Projekt (Summe).
    pub by_project: Vec<ExportAggregatedProjectRow>,
    /// Zeit pro Tätigkeitsklasse (Übersicht).
    pub by_activity_type: Vec<ExportAggregatedActivityTypeRow>,
}

/// Wurzelobjekt der Export-JSON-Datei.
#[derive(Serialize)]
pub struct ExportPayload {
    pub meta: ExportMeta,
    pub activities: Vec<ExportActivity>,
    pub aggregated: ExportAggregated,
}

/// Ergebnis des CSV-Exports (zwei Dateien: Samples + Aggregation).
#[derive(Serialize)]
pub struct ExportCsvResultDto {
    pub samples_path: String,
    pub aggregated_path: String,
}
