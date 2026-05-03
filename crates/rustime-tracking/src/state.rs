// definiert trackingState, der gemeinsame zustand für die ganze app.

use rusqlite::Connection; // sqlite connection aus rusqlite bibliothek
use rustime_core::models::WindowActivity; // gemeinsamer typ aus rustime-core crate
use std::sync::{atomic::AtomicBool, Arc, Mutex}; // Rust-Standardbibliothek für thread-sichere shared state

// tracking state
pub struct TrackingState {
    pub is_running: Arc<AtomicBool>, // flag ob tracking läuft
    pub activities: Arc<Mutex<Vec<WindowActivity>>>, // RAM-Liste für aktuelle aktivitäten
    pub db: Arc<Mutex<Connection>>, // sqlite connection für die database
    /// Aktives Projekt (id, Anzeigename) für DB-Inserts und Events; `None` wenn keins gewählt.
    pub active_project: Arc<Mutex<Option<(i64, String)>>>,
}

// hier kommen methoden, die zu trackingstate gehören
impl TrackingState {
    pub fn new(db: Connection) -> Self {
        Self { // Self gibt den eigenen typ zurück
            is_running: Arc::new(AtomicBool::new(false)), // flag ob tracking läuft
            activities: Arc::new(Mutex::new(Vec::new())), // RAM-Liste für aktuelle aktivitäten
            db: Arc::new(Mutex::new(db)), // sqlite connection für die database
            active_project: Arc::new(Mutex::new(None)), // aktives projekt (id, anzeigename)
        }
    }
}
