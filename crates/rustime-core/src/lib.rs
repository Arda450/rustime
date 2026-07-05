pub mod models;
pub mod window_context;

pub use window_context::{
    ActivityType, classify_activity_type, format_app_label_from_title,
    format_context_label_from_title,
};
