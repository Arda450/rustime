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

pub use export::{
    export_activities_csv_to_paths, export_activities_json_to_path, export_report_pdf_to_path,
    show_activities_json,
};
pub use projects::{
    create_project, delete_project, get_active_project, get_projects, set_active_project,
};
pub use report::{get_by_project_for_range, get_daily_report, get_weekly_report};
pub use settings::{clear_all_activities, clear_all_projects, get_app_stats};
pub use stats::{
    get_activities_page, get_dwell_by_category, get_overview_stats, get_time_series_by_category,
};
pub use tracking::{is_tracking, start_tracking, stop_tracking};
