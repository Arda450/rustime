use crate::DbError;
use rusqlite::Connection;

pub fn init_database() -> Result<Connection, DbError> {
    let app_dir = dirs::document_dir() // findet den dokumentenordner des users
        .ok_or(DbError::AppDirNotFound)?
        .join("rustime-data"); // erstellt unterordner für die datenbank

    std::fs::create_dir_all(&app_dir)?; // erstellt den ordner wenn er nicht existiert
    let db_path = app_dir.join("rustime.db"); // erstellt den pfad zur sqlite-datei mit der endung "rustime.db"
    let conn = Connection::open(db_path)?; // öffnet/erstellt die sqlite-datei

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

    Ok(conn)
}
