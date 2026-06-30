//! Tauri-Commands: öffentliche IPC-API zwischen React-Frontend und Rust-Backend.
//!
//! Jedes Modul gruppiert zusammengehörige #tauri::command - Funktionen.
//! Registrierung aller Commands erfolgt in lib.rs via invoke_handler.

pub mod export;
pub mod projects;
pub mod report;
pub mod settings;
pub mod stats;
pub mod tracking;

pub use export::{export_activities_csv_to_downloads, export_activities_json_to_downloads, show_activities_json};
pub use projects::{get_active_project, get_projects, select_project_path, set_active_project};
pub use report::{get_daily_report, get_weekly_report};
pub use settings::{clear_all_activities, clear_all_projects, get_app_stats};
pub use stats::{
    get_activities_page, get_dwell_by_category, get_time_series_by_category,
};
pub use tracking::{is_tracking, start_tracking, stop_tracking};
