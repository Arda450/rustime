mod activity_repo;
mod error;
mod project_repo;
mod schema;

// hiermit werden die teil der öffentlichen api definiert, die von anderen crates verwendet werden können
pub use activity_repo::{
    count_activities, delete_all_activities, get_activities_with_projects, get_all_activities,
    insert_activity_with_project, ActivityWithProject,
};
pub use error::DbError;
pub use project_repo::{count_projects, delete_all_projects, list_projects, upsert_project, DbProject, get_project_by_id};
pub use schema::init_database;