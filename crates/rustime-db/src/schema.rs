use std::path::{Path, PathBuf};

use crate::DbError;
use rusqlite::Connection;

/// Pfad zur produktiven SQLite-Datei (`Dokumente/rustime-data/rustime.db`).
pub fn default_database_path() -> Result<PathBuf, DbError> {
    let app_dir = dirs::document_dir()
        .ok_or(DbError::AppDirNotFound)?
        .join("rustime-data");
    Ok(app_dir.join("rustime.db"))
}

pub fn init_database() -> Result<Connection, DbError> {
    open_database(&default_database_path()?)
}

/// Öffnet oder erstellt eine SQLite-Datei am angegebenen Pfad und wendet das Schema an.
pub fn open_database(path: &Path) -> Result<Connection, DbError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    apply_schema(&conn)?;
    Ok(conn)
}

fn apply_schema(conn: &Connection) -> Result<(), DbError> {
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            window_title TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            project_id INTEGER REFERENCES projects(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id)",
        [],
    )?;

    Ok(())
}
