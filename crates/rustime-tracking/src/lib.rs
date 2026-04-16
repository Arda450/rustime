// exportiert alles was andere crates verwenden können

mod error;
mod state;
mod tracker;

pub use error::TrackingError;
pub use state::TrackingState;
pub use tracker::{current_timestamp, try_get_active_window_title};
