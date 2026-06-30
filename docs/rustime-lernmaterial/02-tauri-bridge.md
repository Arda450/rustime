# Tauri-Bridge: UI ↔ Rust

Rustime ist eine **Tauri-App**: React im WebView, Logik in Rust. Die Brücke besteht aus **Commands** (Anfrage/Antwort) und **Events** (Push vom Backend).

---

## 1. Command – Frontend ruft Rust auf

### TypeScript (Frontend)

```tsx
import { invoke } from "@tauri-apps/api/core";

// Promise: Rust gibt bool zurück
const running = await invoke<boolean>("is_tracking");

// Mit Parametern (JSON an Rust)
const page = await invoke<ActivitiesPageDto>("get_activities_page", {
  projectId: 1,
  page: 0,
  pageSize: 20,
});
```

### Rust (Backend)

```rust
#[tauri::command]
pub fn get_activities_page(
    state: State<TrackingState>,
    project_id: Option<i64>,
    page: u32,
    page_size: u32,
) -> Result<ActivitiesPageDto, ApiError> {
    let db = state.db.lock().map_err(|_| ApiError::new("DB_LOCK_FAILED", "..."))?;
    // ... SQL ...
    Ok(dto)
}
```

### Registrierung (einmal beim Start)

```rust
.invoke_handler(tauri::generate_handler![
    start_tracking,
    get_activities_page,
    // ...
])
```

| Schritt | Was passiert |
|---------|----------------|
| 1 | UI: `invoke("command_name", { args })` |
| 2 | Tauri serialisiert JSON |
| 3 | Rust-Command läuft (oft mit `State<TrackingState>`) |
| 4 | Rückgabe als JSON ans Frontend |

**Merksatz:** Commands sind wie **API-Endpunkte**, nur lokal zwischen WebView und Rust.

---

## 2. Event – Rust pusht zur UI

Wenn der Tracking-Loop **alle 2 s** sampled, soll die Tabelle nicht bei jedem Sample neu laden. Nur bei **Fensterwechsel**:

```rust
// Rust (tracking.rs, vereinfacht)
if title_changed {
    app_handle.emit("new-activity", dto)?;
}
```

```tsx
// React (App.tsx, vereinfacht)
const unlisten = await listen<Activity>("new-activity", () => {
  setTableRevision((r) => r + 1);
  refreshActivityCount();
});
```

| Commands | Events |
|----------|--------|
| UI fragt an | Backend meldet spontan |
| `invoke` | `listen` / `emit` |
| Pull | Push |

---

## 3. DTO (Data Transfer Object)

Rust-Structs, die **nur für Transport** zur UI dienen:

```rust
// dto/activity.rs – Idee
pub struct ActivityDto {
    pub title: String,
    pub timestamp: u64,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
}
```

TypeScript-Spiegel in `types.ts`.  
**Warum?** DB-Modell und UI-Form können sich unterscheiden; Serde serialisiert sauber nach JSON.

---

## 4. Fehler: `ApiError`

```rust
// Frontend kann string oder strukturiertes JSON bekommen
return Err(ApiError::new("DB_LOCK_FAILED", "Datenbank ist gesperrt"));
```

`OverviewPanel` hat `parseApiError` für lesbare Meldungen.

---

## 5. Typischer Ablauf: Tracking starten

```
[User] Klick „Starte Tracking“
    → invoke("start_tracking")
        → Rust: is_running = true, Thread starten
    → UI: setIsTracking(true)

[Thread alle 2 s]
    → Fenstertitel lesen
    → SQLite INSERT (wenn Projekt gesetzt)
    → bei Titelwechsel: emit("new-activity")

[UI listen]
    → tableRevision++
    → ActivitiesTable lädt Seite neu via get_activities_page
```

---

## 6. Was Tauri **nicht** ist

- Kein klassischer Webserver.
- Kein direkter Zugriff von React auf SQLite (immer über Commands).
- Kein Node.js im Produktivpfad für App-Logik (nur Build/Dev mit Vite).

Nächstes Kapitel: [03-daten-und-aggregation.md](./03-daten-und-aggregation.md)
