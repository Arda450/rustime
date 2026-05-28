//! DTO für eine erfasste Aktivität (Tabelle, Events, Legacy-Liste).

use rustime_core::window_context::format_context_label_from_title;
use serde::Serialize;

/// Eine Aktivität, wie sie die UI per `invoke` oder `new-activity`-Event erhält.
#[derive(Serialize, Clone)]
pub struct ActivityDto {
    /// Roh-Fenstertitel von der Windows-API
    pub title: String,
    /// Lesbares Kontext-Label (aus dem Titel abgeleitet, z. B. App- oder Seitenname)
    pub context_label: String,
    /// Unix-Zeitstempel in Sekunden
    pub timestamp: u64,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
}

impl ActivityDto {
    /// Erzeugt ein DTO und berechnet `context_label` zentral im Backend.
    pub fn from_parts(
        title: String,
        timestamp: u64,
        project_id: Option<i64>,
        project_name: Option<String>,
    ) -> Self {
        // fromat_context_label_from_title liest den titel und gibt ein context label zurück
        // titel bleibt unverändert, context label ist zusätzlich
        let context_label = format_context_label_from_title(&title);
        Self {
            title,
            context_label,
            timestamp,
            project_id,
            project_name,
        }
    }
}
