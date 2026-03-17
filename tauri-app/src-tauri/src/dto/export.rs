use serde::Serialize;

#[derive(Serialize)]
pub struct ExportMeta {
    pub format_version: u32,
    pub exported_at_unix: u64,
    pub entry_count: usize,
    pub timezone: String,
}

#[derive(Serialize)]
pub struct ExportActivity {
    pub title: String,
    pub timestamp: u64,
    pub timestamp_utc: String,
    pub timestamp_local: String,
}

#[derive(Serialize)]
pub struct ExportPayload {
    pub meta: ExportMeta,
    pub activities: Vec<ExportActivity>,
}