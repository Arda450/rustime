//! DTO für ein Nutzerprojekt (Ordner-basierte Projektwahl).

use serde::Serialize;

/// Projekt, wie es in der UI (Picker, Liste, aktives Projekt) angezeigt wird.
#[derive(Serialize)]
pub struct ProjectDto {
    pub id: i64,
    pub name: String,
    /// Dateisystem-Pfad; bei `get_active_project` ggf. leer
    pub path: String,
}
