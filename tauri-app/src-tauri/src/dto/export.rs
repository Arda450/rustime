//! DTOs für den JSON-Export (Vorschau in der UI und Datei in Downloads).

use serde::Serialize;

/// Metadaten zum Export-Lauf (Versionierung, Zeitpunkt, Umfang).
#[derive(Serialize)]
pub struct ExportMeta {
    pub format_version: u32,
    pub exported_at_unix: u64,
    pub entry_count: usize,
    pub timezone: String,
}

/// Eine exportierte Aktivität mit maschinen- und menschenlesbaren Zeitstempeln.
#[derive(Serialize)]
pub struct ExportActivity {
    pub title: String,
    pub timestamp: u64,
    pub timestamp_utc: String,
    pub timestamp_local: String,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
}

/// Wurzelobjekt der Export-JSON-Datei (`meta` + `activities`).
#[derive(Serialize)]
pub struct ExportPayload {
    pub meta: ExportMeta,
    pub activities: Vec<ExportActivity>,
}
