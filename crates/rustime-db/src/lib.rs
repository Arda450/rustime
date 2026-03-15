mod activity_repo;
mod schema;
mod error;

pub use activity_repo::{get_all_activities, insert_activity};
pub use schema::init_database;
pub use error::DbError;