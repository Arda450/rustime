use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct ActivityDto {
    pub title: String,
    pub timestamp: u64,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
}
