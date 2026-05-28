// definiert trackingState, der gemeinsame zustand für die ganze app.

use rusqlite::Connection;
use std::sync::{atomic::AtomicBool, Arc, Mutex};

pub struct TrackingState {
    pub is_running: Arc<AtomicBool>,
    pub db: Arc<Mutex<Connection>>,
    /// Aktives Projekt (id, Anzeigename) für DB-Inserts und Events; `None` wenn keins gewählt.
    pub active_project: Arc<Mutex<Option<(i64, String)>>>,
}

impl TrackingState {
    pub fn new(db: Connection) -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            db: Arc::new(Mutex::new(db)),
            active_project: Arc::new(Mutex::new(None)),
        }
    }
}
