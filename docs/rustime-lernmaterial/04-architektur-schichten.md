# Architektur-Schichten

Grossbild von Rustime (vereinfacht).

```
┌─────────────────────────────────────────────────────────┐
│  React UI (tauri-app/src)                               │
│  App.tsx, OverviewPanel, ActivitiesTable, Charts        │
└───────────────────────────┬─────────────────────────────┘
                            │ invoke / listen
┌───────────────────────────▼─────────────────────────────┐
│  Tauri Commands (tauri-app/src-tauri)                   │
│  tracking, stats, projects, export, settings            │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌────────────────┐  ┌──────────────────┐
│ rustime-     │  │ rustime-db     │  │ rustime-core     │
│ tracking     │  │ SQLite, dwell, │  │ Modelle, Labels  │
│ Windows-API  │  │ Repositories   │  │ aus Fenstertitel │
└──────────────┘  └────────────────┘  └──────────────────┘
```

---

## Crate: `rustime-core`

**Aufgabe:** Gemeinsame Typen und Hilfslogik ohne DB/UI.

- `WindowActivity` (title, timestamp)
- `format_context_label_from_title` → lesbare Kategorie

---

## Crate: `rustime-db`

**Aufgabe:** Alles rund um SQLite.

| Modul | Aufgabe |
|-------|---------|
| `schema` | Tabellen anlegen, Pfad `Dokumente/rustime-data/rustime.db` |
| `activity_repo` | INSERT, paginierte SELECT |
| `project_repo` | Projekte upserten/listen |
| `dwell` | Verweildauer + Zeitserien-Buckets |
| `seed` | Demo-Daten (nur für Tests) |

---

## Crate: `rustime-tracking`

**Aufgabe:** Windows-Fenster lesen + `TrackingState`.

- `try_get_active_window_title()` (Windows-API)
- `TrackingState` mit `AtomicBool`, `Mutex`, `Arc`

---

## Tauri-App `src-tauri`

**Aufgabe:** Commands, DTOs, Fehler, `lib.rs` startet alles.

- **Keine** schwere Logik in `main.rs` (nur `run()`)
- Commands sind dünn: Lock → DB/State → DTO zurück

---

## Frontend `tauri-app/src`

| Ordner | Rolle |
|--------|--------|
| `components/` | UI-Bausteine |
| `hooks/` | Wiederverwendbare Logik (z. B. Projekt-Picker) |
| `utils/` | Chart-Hilfen, Farben, Buckets |
| `styles/` | CSS nach Bereich |

---

## Einstiegspunkte

| Datei | Start |
|-------|--------|
| `src-tauri/src/main.rs` | OS-Prozess |
| `src-tauri/src/lib.rs` | Tauri + DB + Commands |
| `src/main.tsx` | React mount |
| `src/App.tsx` | Tabs + globaler UI-State |

---

## Design-Entscheidungen (Kurz)

| Entscheidung | Warum |
|--------------|--------|
| Aggregation in Rust | Weniger Daten im WebView, eine Quelle für Pie/Export |
| Keine RAM-Liste aller Aktivitäten | Speicher stabil bei langem Tracking |
| Events nur bei Titelwechsel | WebView2 entlasten |
| SQLite lokal | Privacy-by-Design |

Zurück zur Übersicht: [README.md](./README.md)
