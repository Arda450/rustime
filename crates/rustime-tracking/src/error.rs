// tracking-spezifische Fehler hier

use std::fmt::{Display, Formatter};

#[derive(Debug)]
pub enum TrackingError {
    WindowNotFound,
    EmptyTitle,
    LockPoisoned(&'static str),
}

impl Display for TrackingError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            TrackingError::WindowNotFound => write!(f, "Kein aktives Fenster gefunden"),
            TrackingError::EmptyTitle => write!(f, "Fenstertitel ist leer"),
            TrackingError::LockPoisoned(name) => write!(f, "Lock vergiftet: {}", name),
        }
    }
}

impl std::error::Error for TrackingError {}