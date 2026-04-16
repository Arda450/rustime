use serde::Serialize;

#[derive(Serialize)]
pub struct ProjectDto {
  pub id: i64,
  pub name: String,
  pub path: String,
}