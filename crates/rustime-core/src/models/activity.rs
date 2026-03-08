use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct WindowActivity {
    pub title: String,
    pub timestamp: u64, // unix timestamp in seconds
}
