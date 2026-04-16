mod activity_repo;
mod error;
mod project_repo;
mod schema;

// hiermit werden die teil der öffentlichen api definiert, die von anderen crates verwendet werden können
pub use activity_repo::{
    get_activities_with_projects, get_all_activities, insert_activity_with_project,
    ActivityWithProject,
};
pub use error::DbError;
pub use schema::init_database;
pub use project_repo::{DbProject, upsert_project, list_projects};