mod activity_repo;
mod dwell;
mod error;
mod project_repo;
mod schema;
mod seed;

// hiermit werden die teil der öffentlichen api definiert, die von anderen crates verwendet werden können
pub use activity_repo::{
    count_activities, delete_all_activities,
    get_activities_filtered, get_activities_for_project_asc, get_activities_for_project_in_range,
    get_activities_page, get_activities_with_projects, insert_activity_with_project,
    ActivitiesFilter, ActivitiesPage, ActivityWithProject,
};
pub use dwell::{
    dwell_by_category, dwell_by_category_in_range, dwell_by_title_in_range,
    dwell_time_series_by_category, CategoryTimeSeriesPoint, DwellOptions, DwellSegment,
    TimeSeriesOptions,
};
pub use error::DbError;
pub use project_repo::{
    count_projects, delete_all_projects, get_project_by_id, list_projects, upsert_project,
    DbProject,
};
pub use schema::{default_database_path, init_database, open_database};
pub use seed::{seed_demo_data, SeedOptions, SeedReport, SeedTimeMode};
