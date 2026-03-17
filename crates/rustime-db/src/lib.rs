mod activity_repo;
mod error;
mod schema;

// hiermit werden die teil der öffentlichen api definiert, die von anderen crates verwendet werden können
pub use activity_repo::{get_all_activities, insert_activity};
pub use error::DbError;
pub use schema::init_database;
