use rusqlite::Connection;
use crate::DbError;

pub fn init_database() -> Result<Connection, DbError> {
    let app_dir = dirs::document_dir()
        .ok_or(DbError::AppDirNotFound)?
        .join("rustime-data");

    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("rustime.db");

    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        window_title TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    )",
        [],
    )?;

    Ok(conn)
}
