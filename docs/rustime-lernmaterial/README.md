# Rustime – Lernmaterial (Konzepte & State)

Dieser Ordner ist **nur Dokumentation**. Er gehört nicht zur laufenden App, wird nicht gebaut und kann beliebig gelesen oder ergänzt werden.

Ziel: Die **State-Arten** und **abstrakten Konzepte** von Rustime mit **vereinfachten Code-Beispielen** nachvollziehen.

## Inhalt

| Datei | Thema |
|-------|--------|
| [01-state-arten.md](./01-state-arten.md) | React-State, Tauri-State, Arc/Mutex, Revision-Counter, localStorage |
| [02-tauri-bridge.md](./02-tauri-bridge.md) | Commands (`invoke`), Events (`listen`/`emit`), DTOs |
| [03-daten-und-aggregation.md](./03-daten-und-aggregation.md) | SQLite, Polling, Verweildauer, Buckets |
| [04-architektur-schichten.md](./04-architektur-schichten.md) | Crates, Verantwortlichkeiten, Datenfluss |
| [examples/](./examples/) | Kurze Snippets zum Kopieren (nicht kompilierbar) |

## Bezug zum echten Projekt

| Lernmaterial | Echte Datei im Repo |
|--------------|---------------------|
| `TrackingState` | `crates/rustime-tracking/src/state.rs` |
| React App-State | `tauri-app/src/App.tsx` |
| Chart-State | `tauri-app/src/components/OverviewPanel.tsx` |
| Tauri starten | `tauri-app/src-tauri/src/lib.rs` |
| Tracking-Loop | `tauri-app/src-tauri/src/commands/tracking.rs` |

## Empfohlene Lesereihenfolge

1. Architektur (Grossbild)
2. State-Arten (wer hält was?)
3. Tauri-Bridge (wie UI und Rust sprechen)
4. Daten & Aggregation (was in der DB und in Charts passiert)
