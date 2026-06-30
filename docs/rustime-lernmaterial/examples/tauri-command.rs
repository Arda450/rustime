// VEREINFACHT – Tauri-Command-Muster
// Echte Commands: tauri-app/src-tauri/src/commands/*.rs

// use tauri::State;
// use rustime_tracking::TrackingState;

/// Frontend: invoke("is_tracking") → bool
// #[tauri::command]
// pub fn is_tracking(state: State<TrackingState>) -> bool {
//     state.is_running.load(std::sync::atomic::Ordering::SeqCst)
// }

/// Frontend: invoke("get_activities_page", { projectId, page, pageSize })
// #[tauri::command]
// pub fn get_activities_page(
//     state: State<TrackingState>,
//     project_id: Option<i64>,
//     page: u32,
//     page_size: u32,
// ) -> Result<ActivitiesPageDto, ApiError> {
//     let db = state.db.lock().map_err(|_| ApiError::new("DB_LOCK_FAILED", "..."))?;
//     // SQL mit LIMIT/OFFSET
//     Ok(dto)
// }

// Registrierung in lib.rs:
// .manage(TrackingState::new(db))
// .invoke_handler(tauri::generate_handler![is_tracking, get_activities_page])
