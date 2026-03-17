mod error;
mod state;
mod tracker;

pub use error::TrackingError;
pub use state::TrackingState;
pub use tracker::{current_timestamp, get_active_window_title, try_get_active_window_title};
