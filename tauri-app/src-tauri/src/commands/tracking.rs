//! Tracking-Commands: Fenstererfassung starten/stoppen und Aktivitäten abfragen.
//!
//! Der Polling-Loop läuft in einem Hintergrund-Thread. Persistenz nur in SQLite
//! (keine unbegrenzte RAM-Liste). UI-Events (`new-activity`) nur bei Titelwechsel.

use std::collections::HashMap;
use std::sync::{atomic::Ordering, Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};

use crate::dto::activity::ActivityDto;
use rustime_core::models::WindowActivity;
use rustime_tracking::{
    current_timestamp, try_get_active_window_title, TrackingError, TrackingState,
};

const SAMPLE_INTERVAL_SECONDS: u64 = 2;
const AGGREGATION_INTERVAL_SECONDS: u64 = 60;

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct MinuteKey {
    project_id: i64,
    project_name: String,
    title: String,
}

#[derive(Debug)]
struct MinuteAccumulator {
    bucket_start: u64,
    first_sample_ts: Option<u64>,
    total_samples: u64,
    sequence: u64,
    counts: HashMap<MinuteKey, (u64, u64)>,
}

impl MinuteAccumulator {
    fn new(timestamp: u64) -> Self {
        Self {
            bucket_start: minute_start(timestamp),
            first_sample_ts: None,
            total_samples: 0,
            sequence: 0,
            counts: HashMap::new(),
        }
    }

    fn record(&mut self, key: MinuteKey, timestamp: u64) {
        self.first_sample_ts.get_or_insert(timestamp);
        self.total_samples = self.total_samples.saturating_add(1);
        self.sequence = self.sequence.saturating_add(1);
        let entry = self.counts.entry(key).or_insert((0, 0));
        entry.0 = entry.0.saturating_add(1);
        entry.1 = self.sequence;
    }

    fn reset(&mut self, timestamp: u64) {
        self.bucket_start = minute_start(timestamp);
        self.first_sample_ts = None;
        self.total_samples = 0;
        self.sequence = 0;
        self.counts.clear();
    }
}

fn minute_start(timestamp: u64) -> u64 {
    (timestamp / AGGREGATION_INTERVAL_SECONDS) * AGGREGATION_INTERVAL_SECONDS
}

fn persist_dominant_minute(
    accumulator: &MinuteAccumulator,
    db: &Arc<Mutex<rusqlite::Connection>>,
    app: &AppHandle,
) {
    let Some((dominant, _)) = accumulator
        .counts
        .iter()
        .max_by(|(_, left), (_, right)| left.0.cmp(&right.0).then(left.1.cmp(&right.1)))
    else {
        return;
    };

    let duration_seconds = accumulator
        .total_samples
        .saturating_mul(SAMPLE_INTERVAL_SECONDS)
        .min(AGGREGATION_INTERVAL_SECONDS);
    if duration_seconds == 0 {
        return;
    }

    let activity = WindowActivity {
        title: dominant.title.clone(),
        timestamp: accumulator
            .first_sample_ts
            .unwrap_or(accumulator.bucket_start),
    };
    let Ok(db_conn) = db.lock() else {
        eprintln!("DB lock error while persisting minute");
        return;
    };
    if let Err(error) = rustime_db::insert_aggregated_activity_with_project(
        &db_conn,
        &activity,
        dominant.project_id,
        duration_seconds,
    ) {
        eprintln!("DB insert error: {}", error);
        return;
    }

    let dto = ActivityDto::from_parts(
        activity.title,
        activity.timestamp,
        Some(dominant.project_id),
        Some(dominant.project_name.clone()),
    );
    let _ = app.emit("new-activity", dto);
}

/// Erfasst das aktive Fenster leichtgewichtig alle zwei Sekunden im RAM.
/// Pro Minute wird nur die meistgenutzte App als aggregierter DB-Eintrag gespeichert.
#[tauri::command]
pub fn start_tracking(state: State<TrackingState>, app: AppHandle) {
    if state.is_running.swap(true, Ordering::SeqCst) {
        return;
    }

    let run_id = state.session_id.fetch_add(1, Ordering::SeqCst) + 1;
    let is_running = Arc::clone(&state.is_running);
    let session_id = Arc::clone(&state.session_id);
    let db = Arc::clone(&state.db);
    let active_project = Arc::clone(&state.active_project);
    let app_handle = app.clone();

    thread::spawn(move || {
        let mut accumulator = MinuteAccumulator::new(current_timestamp());

        while is_running.load(Ordering::SeqCst) && session_id.load(Ordering::SeqCst) == run_id {
            let timestamp = current_timestamp();
            if minute_start(timestamp) != accumulator.bucket_start {
                persist_dominant_minute(&accumulator, &db, &app_handle);
                accumulator.reset(timestamp);
            }

            let title = match try_get_active_window_title() {
                Ok(title) => title,
                Err(TrackingError::WindowNotFound | TrackingError::EmptyTitle) => {
                    thread::sleep(Duration::from_secs(SAMPLE_INTERVAL_SECONDS));
                    continue;
                }
                Err(e) => {
                    eprintln!("Tracking error: {}", e);
                    thread::sleep(Duration::from_secs(SAMPLE_INTERVAL_SECONDS));
                    continue;
                }
            };

            if !title.is_empty() {
                let proj = active_project.lock().ok().and_then(|g| g.clone());
                if let Some((project_id, project_name)) = proj {
                    accumulator.record(
                        MinuteKey {
                            project_id,
                            project_name,
                            title,
                        },
                        timestamp,
                    );
                }
            }

            thread::sleep(Duration::from_secs(SAMPLE_INTERVAL_SECONDS));
        }

        persist_dominant_minute(&accumulator, &db, &app_handle);
    });
}

/// Stoppt den Hintergrund-Thread (setzt `is_running` auf false).
pub fn stop_tracking_internal(state: &TrackingState) {
    state.is_running.store(false, Ordering::SeqCst);
    state.session_id.fetch_add(1, Ordering::SeqCst);
}

/// Stoppt den Hintergrund-Thread (setzt `is_running` auf false).
#[tauri::command]
pub fn stop_tracking(state: State<TrackingState>) {
    stop_tracking_internal(&state);
}

/// Gibt zurück, ob der Tracking-Loop aktuell läuft.
#[tauri::command]
pub fn is_tracking(state: State<TrackingState>) -> bool {
    state.is_running.load(Ordering::SeqCst)
}
