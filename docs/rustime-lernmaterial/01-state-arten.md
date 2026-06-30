# State-Arten in Rustime

In Rustime gibt es **mehrere „Zustände“ gleichzeitig**. Sie leben an verschiedenen Orten und haben verschiedene Aufgaben.

---

## 1. React UI-State (Frontend, flüchtig)

**Wo:** `App.tsx`, `OverviewPanel.tsx`, Hooks  
**Lebensdauer:** Solange die App im WebView läuft (beim Neustart weg, ausser `localStorage`)

### Einfaches Beispiel

```tsx
// Nur zur Erklärung – vereinfachtes Muster aus App.tsx
const [isTracking, setIsTracking] = useState(false);
const [activeProject, setActiveProject] = useState<Project | null>(null);
const [tableRevision, setTableRevision] = useState(0);
const [dwellRevision, setDwellRevision] = useState(0);
```


| State           | Bedeutung                                                  |
| --------------- | ---------------------------------------------------------- |
| `isTracking`    | Zeigt in der UI „Aktiv / Inaktiv“                          |
| `activeProject` | Welches Projekt gerade gewählt ist (Kopie für die UI)      |
| `tableRevision` | Zähler: Tabelle soll neu laden (z. B. nach `new-activity`) |
| `dwellRevision` | Zähler: Charts alle 10 s neu laden beim Tracking           |


### Warum `tableRevision` / `dwellRevision`?

Statt die ganze Aktivitätenliste im React-State zu halten, gibt es nur einen **Zähler**. Kind-Komponenten reagieren auf Änderung des Zählers und rufen das Backend erneut auf.

```tsx
// Muster: Revision erhöhen → useEffect lädt Daten neu
setTableRevision((r) => r + 1);

// ActivitiesTable bekommt refreshKey={tableRevision}
```

Das ist ein **„Stale-while-revalidate“-Light**: UI bleibt schlank, Daten kommen vom Rust-Backend.

### Persistenz im Browser: Theme

```tsx
const [theme, setTheme] = useState<"dark" | "light">(() => {
  const saved = localStorage.getItem("theme");
  return saved === "light" ? "light" : "dark";
});
```

**Art:** Client-seitiger Speicher (kein Rust, keine DB).

---

## 2. Tauri Managed State (Backend, App-weit)

**Wo:** `TrackingState` in `rustime-tracking`, registriert in `lib.rs` mit `.manage(...)`

```rust
// lib.rs (vereinfacht)
tauri::Builder::default()
    .manage(TrackingState::new(db))
    .invoke_handler(tauri::generate_handler![start_tracking, ...])
```

Jeder Command bekommt Zugriff:

```rust
#[tauri::command]
pub fn is_tracking(state: State<TrackingState>) -> Result<bool, ApiError> {
    Ok(state.is_running.load(Ordering::SeqCst))
}
```


| Eigenschaft                                                                          | Erklärung                        |
| ------------------------------------------------------------------------------------ | -------------------------------- |
| **Eine Instanz** pro App-Lauf                                                        | Gleicher State für alle Commands |
| **Lebt im Rust-Prozess**                                                             | Unabhängig vom React-Render      |
| **Quelle der Wahrheit** für Tracking, DB-Verbindung, aktives Projekt (Backend-Seite) |                                  |


---

## 3. `TrackingState` – die drei Felder

```rust
pub struct TrackingState {
    pub is_running: Arc<AtomicBool>,
    pub db: Arc<Mutex<Connection>>,
    pub active_project: Arc<Mutex<Option<(i64, String)>>>,
}
```

### 3a. `AtomicBool` – läuft Tracking?

```rust
// Start
state.is_running.store(true, Ordering::SeqCst);

// Hintergrund-Thread prüft in der Schleife
while is_running.load(Ordering::SeqCst) {
    // Fenster lesen, DB schreiben ...
}

// Stop
state.is_running.store(false, Ordering::SeqCst);
```

**Warum Atomic?** Mehrere Threads (UI-Thread + Tracking-Thread) lesen/schreiben **ohne Mutex** nur dieses Flag.


| Konzept            | Rolle                                 |
| ------------------ | ------------------------------------- |
| `AtomicBool`       | Thread-sicherer Schalter an/aus       |
| `Ordering::SeqCst` | Strikte Sichtbarkeit zwischen Threads |


### 3b. `Arc<Mutex<Connection>>` – SQLite

```rust
let db_conn = state.db.lock().map_err(|_| ...)?;
insert_activity_with_project(&db_conn, &activity, project_id)?;
// lock wird am Ende des Scopes wieder freigegeben
```


| Teil     | Bedeutung                                                                      |
| -------- | ------------------------------------------------------------------------------ |
| `Arc`    | **Shared ownership**: Haupt-Thread und Tracking-Thread teilen sich dieselbe DB |
| `Mutex`  | **Nur einer** darf gleichzeitig schreiben/lesen                                |
| `lock()` | Wartet, bis die DB frei ist                                                    |


Ohne `Mutex` wären parallele Zugriffe von UI-Command und Tracking-Loop **unsicher**.

### 3c. `Arc<Mutex<Option<(i64, String)>>>` – aktives Projekt

```rust
// Option = vielleicht kein Projekt gewählt
// (i64, String) = (project_id, Anzeigename)
*active_project.lock().unwrap() = Some((42, "rustime".into()));
```

Backend speichert die Projekt-ID für Inserts im Tracking-Loop. Das Frontend hat **zusätzlich** `activeProject` in React (für Anzeige).

---

## 4. Zwei „aktive Projekt“-States – warum?


| Ort                                   | Zweck                                         |
| ------------------------------------- | --------------------------------------------- |
| `TrackingState.active_project` (Rust) | Tracking-Loop schreibt `project_id` in SQLite |
| `App.activeProject` (React)           | Tabs, Labels, Charts filtern nach Projekt     |


Nach `set_active_project` (Command) sollten beide übereinstimmen. Nach „Daten löschen“ setzt das Backend `None` und ruft `onDataCleared()` im UI auf.

---

## 5. Lokaler Komponenten-State

**Beispiel:** `OverviewPanel` hält Chart-Daten nur für die Übersicht:

```tsx
const [dwellSegments, setDwellSegments] = useState<PieSegment[]>([]);
const [timeSeriesByCategory, setTimeSeriesByCategory] = useState<...>([]);
const [chartView, setChartView] = useState<"pie" | "timeseries">("pie");
```

**Nicht** in `App.tsx` – weil nur die Übersicht sie braucht (Kapselung).

`useRef` für `chartsLoadedRef`: Wert ändert sich, **ohne** Re-Render auszulösen (nur interne Logik).

---

## 6. Übersichtstabelle


| State-Art        | Ort          | Persistenz                        | Wer synchronisiert  |
| ---------------- | ------------ | --------------------------------- | ------------------- |
| React `useState` | WebView      | Session (+ Theme in localStorage) | React selbst        |
| Revision-Counter | React        | Nein                              | Events / Intervalle |
| `TrackingState`  | Rust/Tauri   | RAM + SQLite                      | Commands            |
| SQLite-Daten     | `rustime.db` | Disk (Dokumente)                  | DB-Commands         |
| Tauri Events     | IPC          | Nein                              | `emit` / `listen`   |


---

## Merksatz

- **UI-State** = anzeigen und steuern, möglichst wenig Rohdaten.
- **TrackingState** = technische Wahrheit für Threads, DB und Tracking.
- **SQLite** = lange Speicherung der Aktivitäten.
- **Revision** = „bitte neu laden“, ohne grosse Listen im React-State.

Nächstes Kapitel: [02-tauri-bridge.md](./02-tauri-bridge.md)