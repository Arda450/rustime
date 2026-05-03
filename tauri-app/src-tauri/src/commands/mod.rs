pub mod export;
pub mod projects;
pub mod settings;
pub mod tracking;

pub use export::{export_activities_json_to_downloads, show_activities_json};
pub use projects::{get_active_project, get_projects, select_project_path, set_active_project};
pub use settings::{clear_all_activities, clear_all_projects, get_app_stats};
pub use tracking::{get_activities, is_tracking, start_tracking, stop_tracking};

// this whole crate is the bridge between the logic and the UI. it contains all the commands that can be called from the UI.