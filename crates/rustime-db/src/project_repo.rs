use crate::DbError;
use rusqlite::{Connection, params, OptionalExtension};

#[derive(Debug, Clone)]
pub struct DbProject {
  pub id: i64,
  pub name: String,
  pub path: String,
}

// schreibt ein projekt in die datenbank oder aktualisiert es wenn es bereits existiert
// hier wird am ende ein projekt zurückgegeben, Rückgabetyp ist ein objekt
pub fn upsert_project(conn: & Connection, name: &str, path: &str, now_ts: u64) -> Result<DbProject, DbError> {
conn.execute(
  "INSERT INTO projects (name, path, created_at)
  VALUES (?1, ?2, ?3)
  ON CONFLICT(path) DO UPDATE SET name=excluded.name",
  params![name, path, now_ts as i64],
)?;

let mut stmt = conn.prepare("SELECT id, name, path FROM projects WHERE path = ?1")?; // sucht nach einem projekt mit dem gegebenen path
let p = stmt.query_row([path], |row| {
  Ok(DbProject {
    id: row.get(0)?,
    name: row.get(1)?,
    path: row.get(2)?,
  })
})?;

Ok(p)

}


// listet alle projekte in der datenbank und gibt sie als vector von dbprojects zurück
// Rückgabetyp ist ein vector von dbprojects
pub fn list_projects(conn: &Connection) -> Result<Vec<DbProject>, DbError> {
    let mut stmt = conn.prepare("SELECT id, name, path FROM projects ORDER BY name ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(DbProject {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// Löscht alle Projekte aus der Datenbank.
pub fn delete_all_projects(conn: &Connection) -> Result<usize, DbError> {
    let count = conn.execute("DELETE FROM projects", [])?;
    Ok(count)
}

/// Gibt die Anzahl der Projekte zurück.
pub fn count_projects(conn: &Connection) -> Result<i64, DbError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;
    Ok(count)
}

pub fn get_project_by_id(conn: &Connection, project_id: i64) -> Result<Option<DbProject>, DbError> {
    let mut stmt = conn.prepare("SELECT id, name, path FROM projects WHERE id = ?1")?;
    let project = stmt.query_row([project_id], |row| {
        Ok(DbProject {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
        })
    })
    .optional()?;

    Ok(project)
}
