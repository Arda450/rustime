use rusqlite::Connection;
use rustime_core::models::WindowActivity;
use crate::DbError;

pub fn insert_activity(conn: &Connection, activity: &WindowActivity) -> Result<(), DbError> {
    conn.execute(
        "INSERT INTO activities (window_title, timestamp) VALUES (?1, ?2)",
        [&activity.title, &activity.timestamp.to_string()],
    )?;
    Ok(())
}

pub fn get_all_activities(conn: &Connection) -> Result<Vec<WindowActivity>, DbError> {
    let mut stmt =
        conn.prepare("SELECT window_title, timestamp FROM activities ORDER BY timestamp DESC")?;

    let activities = stmt
        .query_map([], |row| {
            Ok(WindowActivity {
                title: row.get(0)?,
                timestamp: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(activities)
}
