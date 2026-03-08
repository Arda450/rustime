use rusqlite::Connection;
use rustime_core::models::WindowActivity;
use std::sync::{atomic::AtomicBool, Arc, Mutex};

// tracking state
pub struct TrackingState {
    pub is_running: Arc<AtomicBool>, // whether the tracking is running or not
    pub activities: Arc<Mutex<Vec<WindowActivity>>>, // list of activities
    pub db: Arc<Mutex<Connection>>,  // database connection
}

impl TrackingState {
    pub fn new(db: Connection) -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            activities: Arc::new(Mutex::new(Vec::new())),
            db: Arc::new(Mutex::new(db)),
        }
    }
}
