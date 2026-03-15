// db-spezifische Fehler hier
// aus standard library importiert, für benutzerfreundliche Fehlermeldungen
use std::fmt::{Display, Formatter};

#[derive(Debug)]
pub enum DbError {
    Sql(rusqlite::Error),
    Io(std::io::Error),
    AppDirNotFound,
}

impl Display for DbError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            DbError::Sql(e) => write!(f, "SQL Fehler: {}", e),
            DbError::Io(e) => write!(f, "I/O Fehler: {}", e),
            DbError::AppDirNotFound => write!(f, "Dokumente-Ordner nicht gefunden"),
        }
    }
}

impl std::error::Error for DbError {}

// konvertierung von rusqlite::Error und std::io::Error zu DbError
impl From<rusqlite::Error> for DbError {
    fn from(value: rusqlite::Error) -> Self {
        DbError::Sql(value)
    }
}

impl From<std::io::Error> for DbError {
    fn from(value: std::io::Error) -> Self {
        DbError::Io(value)
    }
}