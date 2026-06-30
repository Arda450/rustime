// VEREINFACHT – TrackingState-Muster wie in rustime-tracking
// Nicht als eigenes Crate gebaut.

use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex};

/// App-weiter Zustand in Rust (Tauri `.manage(...)`).
pub struct TrackingState {
    /// Thread-sicherer Schalter: läuft der Polling-Loop?
    pub is_running: Arc<AtomicBool>,
    /// SQLite – nur ein Thread darf gleichzeitig zugreifen
    pub db: Arc<Mutex<()>>, // () statt Connection: nur Demo
    /// Welches Projekt für Inserts? None = noch keins gewählt
    pub active_project: Arc<Mutex<Option<(i64, String)>>>,
}

impl TrackingState {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            db: Arc::new(Mutex::new(())),
            active_project: Arc::new(Mutex::new(None)),
        }
    }
}

/// Hintergrund-Thread (vereinfacht)
fn polling_loop(is_running: Arc<AtomicBool>) {
    while is_running.load(Ordering::SeqCst) {
        // 1) Fenstertitel von Windows lesen
        // 2) db.lock() → INSERT
        // 3) bei Titelwechsel: Event an UI
        std::thread::sleep(std::time::Duration::from_secs(2));
    }
}

fn start(state: &TrackingState) {
    if state.is_running.load(Ordering::SeqCst) {
        return;
    }
    state.is_running.store(true, Ordering::SeqCst);
    let flag = Arc::clone(&state.is_running);
    std::thread::spawn(move || polling_loop(flag));
}

fn stop(state: &TrackingState) {
    state.is_running.store(false, Ordering::SeqCst);
}
