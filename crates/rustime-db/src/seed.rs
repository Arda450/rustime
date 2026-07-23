//! Demo-Daten für UI- und Performance-Tests.
//!
//! Simuliert echtes Tracking: Minutenaggregate in Arbeitsblöcken,
//! mit Pausen (Nacht, Mittag). Schwerpunkt auf Projekt „rustime“.

use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{Local, TimeZone};
use rusqlite::{params, Connection};

use crate::activity_repo::{count_activities, delete_all_activities};
use crate::project_repo::{delete_all_projects, upsert_project};
use crate::DbError;

/// Wie die persistierte Minutenaggregation (siehe `start_tracking`).
const POLL_INTERVAL_SECS: u64 = 60;

/// Fenster bleiben mehrere Minuten gleich, dann Wechsel.
const MIN_SAMPLES_PER_TITLE: u64 = 2;
const MAX_SAMPLES_PER_TITLE: u64 = 5;

const RUSTIME_TITLES: &[&str] = &[
    "lib.rs - rustime - Visual Studio Code",
    "OverviewPanel.tsx - rustime - Visual Studio Code",
    "dwell.rs - rustime - Visual Studio Code",
    "DailyReportView.tsx - rustime - Visual Studio Code",
    "Terminal - rustime",
    "Pull requests · Arda450/rustime - GitHub — Mozilla Firefox",
];

const MPP_TITLES: &[&str] = &[
    "Major_Project_Proposal.pdf - MPP - Visual Studio Code",
    "Notion – Major Project",
];

const OTHER_TITLES: &[&str] = &[
    "YouTube — Mozilla Firefox",
    "Discord",
    "Slack | general",
    "Windows-Einstellungen",
];

/// Arbeitsblöcke innerhalb eines Kalendertags (Offset ab Mitternacht, Sekunden).
struct WorkBlock {
    start: u64,
    end: u64,
    /// 0 = rustime, 1 = mpp-docs, 2 = nebenprojekt
    project_index: usize,
}

const WORK_BLOCKS_24H: &[WorkBlock] = &[
    WorkBlock {
        start: 7 * 3600,
        end: 11 * 3600 + 30 * 60,
        project_index: 0,
    },
    WorkBlock {
        start: 12 * 3600 + 30 * 60,
        end: 17 * 3600,
        project_index: 0,
    },
    WorkBlock {
        start: 18 * 3600,
        end: 19 * 3600,
        project_index: 1,
    },
    WorkBlock {
        start: 19 * 3600 + 30 * 60,
        end: 20 * 3600 + 25 * 60,
        project_index: 2,
    },
    WorkBlock {
        start: 20 * 3600 + 30 * 60,
        end: 22 * 3600,
        project_index: 0,
    },
];

/// Zeitraum für Demo-Daten.
#[derive(Debug, Clone)]
pub enum SeedTimeMode {
    /// Letzte N Stunden ab jetzt (rollierend).
    RollingHours(u64),
    /// N Kalendertage (lokal): heute + (N−1) vergangene volle Tage.
    CalendarDays(u64),
}

impl Default for SeedTimeMode {
    fn default() -> Self {
        Self::RollingHours(24)
    }
}

#[derive(Debug, Clone)]
pub struct SeedOptions {
    pub time_mode: SeedTimeMode,
    pub clear_existing: bool,
}

impl Default for SeedOptions {
    fn default() -> Self {
        Self {
            time_mode: SeedTimeMode::RollingHours(24),
            clear_existing: true,
        }
    }
}

impl SeedOptions {
    /// Kurzform: rollierendes 24-Stunden-Fenster (Abwärtskompatibilität).
    pub fn rolling_hours(hours: u64) -> Self {
        Self {
            time_mode: SeedTimeMode::RollingHours(hours),
            clear_existing: true,
        }
    }

    /// Empfohlen für Tagesberichte: heute + vergangene Kalendertage.
    pub fn calendar_days(days: u64) -> Self {
        Self {
            time_mode: SeedTimeMode::CalendarDays(days.max(1)),
            clear_existing: true,
        }
    }

    /// Abwärtskompatibilität für `--hours`.
    pub fn hours_back(&self) -> u64 {
        match self.time_mode {
            SeedTimeMode::RollingHours(h) => h,
            SeedTimeMode::CalendarDays(d) => d * 24,
        }
    }

    pub fn set_hours_back(&mut self, hours: u64) {
        self.time_mode = SeedTimeMode::RollingHours(hours);
    }
}

#[derive(Debug, Clone)]
pub struct SeedReport {
    pub projects_created: usize,
    pub activities_inserted: usize,
    pub from_ts: u64,
    pub to_ts: u64,
    pub poll_interval_seconds: u64,
    pub calendar_days: Option<u64>,
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn local_midnight_unix(days_ago: i64) -> u64 {
    let today = Local::now().date_naive();
    let date = today - chrono::Duration::days(days_ago);
    Local
        .from_local_datetime(&date.and_hms_opt(0, 0, 0).expect("Mitternacht ist gültig"))
        .single()
        .map(|dt| dt.timestamp().max(0) as u64)
        .unwrap_or(0)
}

fn titles_for_project(project_index: usize) -> &'static [&'static str] {
    match project_index {
        0 => RUSTIME_TITLES,
        1 => MPP_TITLES,
        _ => OTHER_TITLES,
    }
}

fn samples_per_title(sample_index: u64) -> u64 {
    MIN_SAMPLES_PER_TITLE + (sample_index % (MAX_SAMPLES_PER_TITLE - MIN_SAMPLES_PER_TITLE + 1))
}

fn append_block_samples(
    rows: &mut Vec<(u64, String, usize)>,
    block_start: u64,
    block_end: u64,
    project_index: usize,
    global_sample: &mut u64,
) {
    if block_end <= block_start {
        return;
    }

    let titles = titles_for_project(project_index);
    let mut ts = block_start;
    let mut title_idx = 0usize;
    let mut remaining_in_title = samples_per_title(*global_sample);

    while ts < block_end {
        let title = titles[title_idx % titles.len()];
        rows.push((ts, title.to_string(), project_index));

        ts = ts.saturating_add(POLL_INTERVAL_SECS);
        *global_sample += 1;
        remaining_in_title = remaining_in_title.saturating_sub(1);
        if remaining_in_title == 0 {
            title_idx += 1;
            remaining_in_title = samples_per_title(*global_sample);
        }
    }
}

/// Rollierendes Fenster: skaliert Arbeitsblöcke auf N Stunden.
fn plan_rolling_samples(from_ts: u64, hours_back: u64) -> Vec<(u64, String, usize)> {
    let span = hours_back.max(1) * 3600;
    let scale = span as f64 / (24 * 3600) as f64;

    let mut rows = Vec::new();
    let mut global_sample = 0u64;

    for block in WORK_BLOCKS_24H {
        let start = from_ts + (block.start as f64 * scale) as u64;
        let end = from_ts + (block.end as f64 * scale) as u64;
        append_block_samples(
            &mut rows,
            start,
            end,
            block.project_index,
            &mut global_sample,
        );
    }

    rows.sort_by_key(|(ts, _, _)| *ts);
    rows
}

/// Kalendertage: volle Arbeitsblöcke pro Tag; heute nur bis jetzt.
fn plan_calendar_samples(days: u64, now: u64) -> Vec<(u64, String, usize)> {
    let mut rows = Vec::new();
    let mut global_sample = 0u64;

    for days_ago in 0..days {
        let day_start = local_midnight_unix(days_ago as i64);
        let day_cap = if days_ago == 0 {
            now
        } else {
            day_start.saturating_add(86_400)
        };

        for block in WORK_BLOCKS_24H {
            let start = day_start.saturating_add(block.start);
            let end = day_start.saturating_add(block.end).min(day_cap);
            append_block_samples(
                &mut rows,
                start,
                end,
                block.project_index,
                &mut global_sample,
            );
        }
    }

    rows.sort_by_key(|(ts, _, _)| *ts);
    rows
}

fn insert_planned_samples(
    conn: &Connection,
    planned: &[(u64, String, usize)],
    project_ids: &[i64],
) -> Result<(), DbError> {
    let tx = conn.unchecked_transaction()?;
    const INSERT: &str = "INSERT INTO activities
        (window_title, timestamp, project_id, duration_seconds)
        VALUES (?1, ?2, ?3, ?4)";

    for (ts, title, project_index) in planned {
        let idx = (*project_index).min(project_ids.len().saturating_sub(1));
        let project_id = project_ids[idx];
        tx.execute(
            INSERT,
            params![title, *ts as i64, project_id, POLL_INTERVAL_SECS as i64],
        )?;
    }

    tx.commit()?;
    Ok(())
}

const DEMO_PROJECTS: [(&str, &str); 3] = [
    ("rustime", r"C:\repos\rustime"),
    ("mpp-docs", r"C:\repos\rustime\mpp"),
    ("nebenprojekt", r"C:\dev\side-project"),
];

/// Legt Demo-Projekte an und fügt realistische Aktivitäten in einer Transaktion ein.
pub fn seed_demo_data(conn: &Connection, opts: &SeedOptions) -> Result<SeedReport, DbError> {
    if opts.clear_existing {
        delete_all_activities(conn)?;
        delete_all_projects(conn)?;
    }

    let now = now_unix();

    let (planned, from_ts, to_ts, calendar_days) = match opts.time_mode {
        SeedTimeMode::RollingHours(hours) => {
            let span_secs = hours.max(1) * 3600;
            let from = now.saturating_sub(span_secs);
            (plan_rolling_samples(from, hours), from, now, None)
        }
        SeedTimeMode::CalendarDays(days) => {
            let planned = plan_calendar_samples(days, now);
            let from = local_midnight_unix((days.saturating_sub(1)) as i64);
            (planned, from, now, Some(days))
        }
    };

    let mut project_ids = Vec::with_capacity(DEMO_PROJECTS.len());
    for (name, path) in DEMO_PROJECTS {
        let p = upsert_project(conn, name, path, now)?;
        project_ids.push(p.id);
    }

    insert_planned_samples(conn, &planned, &project_ids)?;

    let total = count_activities(conn)? as usize;

    Ok(SeedReport {
        projects_created: project_ids.len(),
        activities_inserted: total,
        from_ts,
        to_ts,
        poll_interval_seconds: POLL_INTERVAL_SECS,
        calendar_days,
    })
}
