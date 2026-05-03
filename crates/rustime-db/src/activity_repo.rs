// liest und schreibt aktivitäten in die datenbank

use crate::DbError;
use rusqlite::{Connection, params};
use rustime_core::models::WindowActivity;

/// Aktivität inkl. optionaler Projekt-Zuordnung (über `LEFT JOIN`).
#[derive(Debug, Clone)]
pub struct ActivityWithProject {
    pub title: String,
    pub timestamp: u64,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
}

pub fn insert_activity_with_project(
    conn: &Connection,
    activity: &WindowActivity,
    project_id: i64,
) -> Result<(), DbError> {
    conn.execute(
        "INSERT INTO activities (window_title, timestamp, project_id) VALUES (?1, ?2, ?3)",
        params![activity.title, activity.timestamp as i64, project_id],
    )?;
    Ok(())
}

// lädt alle aktivitäten aus der datenbank und gibt sie als vector von windowactivities zurück
// direkter zugriff auf sqlite
pub fn get_all_activities(conn: &Connection) -> Result<Vec<WindowActivity>, DbError> {
    let mut stmt =
        conn.prepare("SELECT window_title, timestamp FROM activities ORDER BY timestamp DESC")?;

    let activities = stmt
        .query_map([], |row| {
            Ok(WindowActivity {
                title: row.get(0)?,
                timestamp: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(activities)
}

/// Lädt alle Aktivitäten mit optionaler Projekt-Info (LEFT JOIN).
pub fn get_activities_with_projects(conn: &Connection) -> Result<Vec<ActivityWithProject>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT a.window_title, a.timestamp, a.project_id, p.name
         FROM activities a
         LEFT JOIN projects p ON a.project_id = p.id
         ORDER BY a.timestamp DESC",
    )?;

    let rows = stmt
        .query_map([], |row| {
            let ts: i64 = row.get(1)?;
            Ok(ActivityWithProject {
                title: row.get(0)?,
                timestamp: ts as u64,
                project_id: row.get(2)?,
                project_name: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Löscht alle Aktivitäten aus der Datenbank.
pub fn delete_all_activities(conn: &Connection) -> Result<usize, DbError> {
    let count = conn.execute("DELETE FROM activities", [])?;
    Ok(count)
}

/// Gibt die Anzahl der Aktivitäten zurück.
pub fn count_activities(conn: &Connection) -> Result<i64, DbError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM activities", [], |row| row.get(0))?;
    Ok(count)
}
