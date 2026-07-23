//! Lese- und Schreibzugriff auf die Tabelle `activities` (Schema: `schema.rs`).
//!
//! Dieses Modul führt SQL aus; es öffnet die DB-Datei nicht selbst.
//! Die `Connection` wird beim App-Start via `init_database()` erzeugt und
//! als Parameter durchgereicht (z. B. über `TrackingState` in `stats.rs`).

use crate::DbError;
use rusqlite::{params, Connection};
use rustime_core::models::WindowActivity;

/// Eine Aktivität inkl. optionaler Projekt-Zuordnung.
///
/// Entspricht einem JOIN aus `activities` + `projects`:
/// - `title` ← `activities.window_title` (Roh-Fenstertitel von Windows)
/// - `timestamp` ← `activities.timestamp` (Unix-Sekunden)
/// - `project_id` / `project_name` ← optional über `LEFT JOIN`
///
/// Hinweis: `context_label` gibt es hier nicht – wird erst in `ActivityDto`
/// aus `title` abgeleitet (`format_context_label_from_title`).
#[derive(Debug, Clone)]
pub struct ActivityWithProject {
    pub title: String,
    pub timestamp: u64,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub duration_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct ActivityOverviewSummary {
    pub activity_count: i64,
    pub total_active_seconds: u64,
    pub today_active_seconds: u64,
    pub active_days: i64,
    pub first_activity_ts: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct ProjectActivityTotal {
    pub name: String,
    pub active_seconds: u64,
}

/// Filterkriterien für die paginierte Aktivitätstabelle.
///
/// Alle Felder sind optional: `None` bedeutet „kein Filter auf dieses Kriterium“.
/// Die UI sendet die Werte über `stats.rs::get_activities_page` (Tauri-Bridge).
#[derive(Debug, Clone, Default)]
pub struct ActivitiesFilter {
    /// Nur Aktivitäten dieses Projekts; `None` = alle Projekte.
    pub project_id: Option<i64>,
    /// Untere Grenze (Unix-Sekunden, inklusiv). `None` = kein Startdatum.
    pub from_ts: Option<u64>,
    /// Obere Grenze (Unix-Sekunden, inklusiv). `None` = kein Enddatum.
    pub to_ts: Option<u64>,
    /// Textsuche im Roh-Fenstertitel (`window_title`). `None` oder leer = keine Suche.
    pub context_query: Option<String>,
}

/// Schreibt den dominanten Fenstertitel eines Aggregationsfensters.
pub fn insert_aggregated_activity_with_project(
    conn: &Connection,
    activity: &WindowActivity,
    project_id: i64,
    duration_seconds: u64,
) -> Result<(), DbError> {
    conn.execute(
        "INSERT INTO activities
            (window_title, timestamp, project_id, duration_seconds)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            activity.title,
            activity.timestamp as i64,
            project_id,
            duration_seconds as i64
        ],
    )?;
    Ok(())
}

/// Lädt **alle** Aktivitäten aller Projekte, neueste zuerst.
///
/// Keine Paginierung – bei vielen Einträgen kann das teuer werden.
///
/// # Aufrufer
/// - `export.rs` (JSON/CSV-Export des vollständigen Datenbestands)
pub fn get_activities_with_projects(
    conn: &Connection,
) -> Result<Vec<ActivityWithProject>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT a.window_title, a.timestamp, a.project_id, p.name, a.duration_seconds
         FROM activities a
         LEFT JOIN projects p ON a.project_id = p.id
         ORDER BY a.timestamp DESC",
    )?;

    let rows = stmt
        .query_map([], map_activity_row)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Löscht sämtliche Zeilen aus `activities`.
pub fn delete_all_activities(conn: &Connection) -> Result<usize, DbError> {
    let count = conn.execute("DELETE FROM activities", [])?;
    Ok(count)
}

/// Zählt alle Aktivitäten (über alle Projekte).
pub fn count_activities(conn: &Connection) -> Result<i64, DbError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM activities", [], |row| row.get(0))?;
    Ok(count)
}

/// Appweite Kennzahlen, vollständig in SQLite aggregiert.
pub fn get_activity_overview_summary(
    conn: &Connection,
    today_start_ts: u64,
) -> Result<ActivityOverviewSummary, DbError> {
    let (count, first, active_days, total_seconds, today_seconds): (
        i64,
        Option<i64>,
        i64,
        i64,
        i64,
    ) = conn.query_row(
        "SELECT COUNT(*),
                MIN(timestamp),
                COUNT(DISTINCT date(timestamp, 'unixepoch', 'localtime')),
                COALESCE(SUM(duration_seconds), 0),
                COALESCE(SUM(CASE WHEN timestamp >= ?1 THEN duration_seconds ELSE 0 END), 0)
         FROM activities",
        [today_start_ts as i64],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        },
    )?;

    Ok(ActivityOverviewSummary {
        activity_count: count,
        total_active_seconds: total_seconds.max(0) as u64,
        today_active_seconds: today_seconds.max(0) as u64,
        active_days,
        first_activity_ts: first.map(|value| value.max(0) as u64),
    })
}

/// Gesamte Sample-Zeit je Projekt, ohne Rohaktivitäten zu laden.
pub fn get_project_activity_totals(
    conn: &Connection,
) -> Result<Vec<ProjectActivityTotal>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT COALESCE(p.name, 'Ohne Projekt'),
                COALESCE(SUM(a.duration_seconds), 0) AS active_seconds
         FROM activities a
         LEFT JOIN projects p ON a.project_id = p.id
         GROUP BY a.project_id, p.name
         ORDER BY active_seconds DESC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            let seconds: i64 = row.get(1)?;
            Ok(ProjectActivityTotal {
                name: row.get(0)?,
                active_seconds: seconds.max(0) as u64,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// Lädt Aktivitäten eines Projekts in einem Zeitfenster (inklusiv), **älteste zuerst**.
pub fn get_activities_for_project_in_range(
    conn: &Connection,
    project_id: i64,
    from_ts: u64,
    to_ts: u64,
) -> Result<Vec<ActivityWithProject>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT a.window_title, a.timestamp, a.project_id, p.name, a.duration_seconds
         FROM activities a
         LEFT JOIN projects p ON a.project_id = p.id
         WHERE a.project_id = ?1
           AND a.timestamp >= ?2
           AND a.timestamp <= ?3
         ORDER BY a.timestamp ASC",
    )?;

    let rows = stmt
        .query_map((project_id, from_ts as i64, to_ts as i64), map_activity_row)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Ergebnis einer paginierten Abfrage für die Aktivitätstabelle in der UI.
#[derive(Debug, Clone)]
pub struct ActivitiesPage {
    /// Die Einträge **dieser Seite** (max. `page_size`, typisch 20).
    pub items: Vec<ActivityWithProject>,
    /// Gesamtanzahl passender Einträge **nach Filter** (für Paginierung).
    pub total_count: i64,
}

/// Wandelt eine SQLite-Zeile in `ActivityWithProject` um (gemeinsam für alle SELECTs).
fn map_activity_row(row: &rusqlite::Row<'_>) -> Result<ActivityWithProject, rusqlite::Error> {
    let ts: i64 = row.get(1)?;
    Ok(ActivityWithProject {
        title: row.get(0)?,
        timestamp: ts as u64,
        project_id: row.get(2)?,
        project_name: row.get(3)?,
        duration_seconds: row.get::<_, i64>(4)?.max(0) as u64,
    })
}

/// Normalisiert den Kontext-Suchstring: trimmen; leer → `None`.
fn normalized_context_query(query: Option<String>) -> Option<String> {
    query.and_then(|q| {
        let trimmed = q.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

/// SQL-`WHERE`-Klausel für Tabellenfilter.
///
/// `?1`–`?4` sind optional: SQLite behandelt `NULL` als „Bedingung ignorieren“
/// (`? IS NULL OR …`). So brauchen COUNT und SELECT dieselbe Klausel.
const FILTER_WHERE: &str = "
WHERE (?1 IS NULL OR a.project_id = ?1)
  AND (?2 IS NULL OR a.timestamp >= ?2)
  AND (?3 IS NULL OR a.timestamp <= ?3)
  AND (?4 IS NULL OR a.window_title LIKE '%' || ?4 || '%')";

/// Übersetzt UI-Sortierfelder in eine sichere `ORDER BY`-Klausel (Whitelist, kein String-Interpolation in Spaltennamen).
/// &str ist eine borrowed string slice. nimmt referenz auf einen string ohne besitz anzunehmen.
fn order_clause(sort_by: &str, sort_order: &str) -> &'static str {
    // ascending order, default ist absteigend
    let asc = matches!(sort_order.to_ascii_lowercase().as_str(), "asc");
    match sort_by {
        "context" | "title" => {
            // context oder title sortieren
            if asc {
                "ORDER BY a.window_title ASC"
            } else {
                "ORDER BY a.window_title DESC"
            }
        }
        "project" => {
            if asc {
                "ORDER BY p.name ASC"
            } else {
                "ORDER BY p.name DESC"
            }
        }
        "timestamp" | "date" | "time" => {
            if asc {
                "ORDER BY a.timestamp ASC"
            } else {
                "ORDER BY a.timestamp DESC"
            }
        }
        _ => "ORDER BY a.timestamp DESC", // unbekannter wert, default ist absteigend
    }
}

/// Lädt eine Seite Aktivitäten für die UI-Tabelle (serverseitige Paginierung + Filter).
///
/// Pro Aufruf laufen **zwei** SQL-Queries mit **identischen** Filterbedingungen:
/// 1. `COUNT(*)` → `total_count` (für Paginierung)
/// 2. `SELECT … LIMIT … OFFSET …` → `items` (nur diese Seite, max. `page_size`)
///
/// # Aufrufer
/// `stats.rs::get_activities_page` → `ActivitiesTable.tsx` via `invoke`
pub fn get_activities_page(
    conn: &Connection,
    filter: &ActivitiesFilter,
    page: u32,
    page_size: u32,
    sort_by: String,
    sort_order: String,
) -> Result<ActivitiesPage, DbError> {
    let order = order_clause(&sort_by, &sort_order);
    let page_size = page_size.clamp(1, 100) as i64;
    let offset = (page as i64).saturating_mul(page_size);

    // Bind-Parameter: Option = NULL in SQLite → Filter aus
    let pid = filter.project_id;
    let from_ts: Option<i64> = filter.from_ts.map(|t| t as i64);
    let to_ts: Option<i64> = filter.to_ts.map(|t| t as i64);
    let context = normalized_context_query(filter.context_query.clone());

    // --- Query 1: zählen (keine Zeilen laden) ---
    let count_sql = format!("SELECT COUNT(*) FROM activities a {FILTER_WHERE}");
    let total: i64 = conn.query_row(
        &count_sql,
        (pid, from_ts, to_ts, context.as_deref()),
        |row| row.get(0),
    )?;

    // --- Query 2: eine Seite laden ---
    let select_sql = format!(
        "SELECT a.window_title, a.timestamp, a.project_id, p.name, a.duration_seconds
         FROM activities a
         LEFT JOIN projects p ON a.project_id = p.id
         {FILTER_WHERE}
         {order}
         LIMIT ?5 OFFSET ?6"
    );

    let mut stmt = conn.prepare(&select_sql)?;
    let rows = stmt
        .query_map(
            (pid, from_ts, to_ts, context.as_deref(), page_size, offset),
            map_activity_row,
        )?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ActivitiesPage {
        items: rows,
        total_count: total,
    })
}

/// Lädt **alle** Aktivitäten passend zum Filter, **älteste zuerst** (für Export/Aggregation).
pub fn get_activities_filtered(
    conn: &Connection,
    filter: &ActivitiesFilter,
) -> Result<Vec<ActivityWithProject>, DbError> {
    let pid = filter.project_id;
    let from_ts: Option<i64> = filter.from_ts.map(|t| t as i64);
    let to_ts: Option<i64> = filter.to_ts.map(|t| t as i64);
    let context = normalized_context_query(filter.context_query.clone());

    let select_sql = format!(
        "SELECT a.window_title, a.timestamp, a.project_id, p.name, a.duration_seconds
         FROM activities a
         LEFT JOIN projects p ON a.project_id = p.id
         {FILTER_WHERE}
         ORDER BY a.timestamp ASC"
    );

    let mut stmt = conn.prepare(&select_sql)?;
    let rows = stmt
        .query_map((pid, from_ts, to_ts, context.as_deref()), map_activity_row)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}
