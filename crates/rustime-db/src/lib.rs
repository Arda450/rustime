mod activity_repo;
mod dwell;
mod error;
mod project_repo;
mod schema;

// hiermit werden die teil der öffentlichen api definiert, die von anderen crates verwendet werden können
pub use activity_repo::{
    count_activities, count_activities_for_project, delete_all_activities,
    get_activities_for_project_asc, get_activities_page, get_activities_with_projects,
    get_all_activities, insert_activity_with_project, ActivitiesPage, ActivityWithProject,
};
pub use dwell::{
    dwell_by_category, dwell_time_series, dwell_time_series_by_category, CategoryTimeSeriesPoint,
    DwellOptions, DwellSegment, TimeSeriesOptions, TimeSeriesPoint,
};
pub use error::DbError;
pub use project_repo::{
    count_projects, delete_all_projects, get_project_by_id, list_projects, upsert_project,
    DbProject,
};
pub use schema::init_database;
