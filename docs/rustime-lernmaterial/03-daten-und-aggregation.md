# Daten & Aggregation

Wie aus **einzelnen Fenster-Samples** Tabellen und Charts entstehen.

---

## 1. Rohdaten: Aktivitäten

Jeder Eintrag in SQLite (vereinfacht):

```
activities: id, window_title, timestamp, project_id
```

Tracking schreibt alle **2 Sekunden** (wenn Projekt aktiv), aber die UI bekommt **nicht** jedes Sample als Event (nur bei Titelwechsel).

---

## 2. Verweildauer aus Samples (Konzept)

Zwischen zwei Einträgen wird eine **aktive Zeit** geschätzt:

```
Sample A (10:00:00) ──► Sample B (10:00:08)
         │                      │
         └── Segment-Länge = min(8s, max_gap) ──┘
```

In Rustime: `max_segment_gap_seconds` oft **120** (2 Minuten Cap).

```rust
// dwell.rs – vereinfachte Idee
let raw_delta = next.timestamp - start.timestamp;
let delta = raw_delta.min(max_segment_gap_seconds);
let end = start + delta;
// Sekunden der Kategorie "start" werden summiert
```

| Begriff | Bedeutung |
|---------|-----------|
| **Sample** | Ein DB-Eintrag (Fenstertitel + Zeit) |
| **Segment** | Geschätzte Dauer, in der man beim *ersten* Titel „geblieben“ ist |
| **Gap-Cap** | Lange Pause wird nicht voll angerechnet |

---

## 3. Pie-Chart: `dwell_by_category`

- Input: alle Aktivitäten eines Projekts (zeitlich sortiert)
- Output: Liste `{ name: "VS Code", value_seconds: 7200 }`
- **Kein** Zeitfenster-Filter im Frontend (gesamte Historie des Projekts)
- Top-N + „Sonstige“

---

## 4. Zeitverlauf: Buckets

**Bucket** = festes Zeitfenster auf der X-Achse (z. B. 15 Minuten = 900 s).

```
|---- 15 min ----|---- 15 min ----|---- 15 min ----|
15:00            15:15            15:30
```

Pro Bucket und Kategorie: Summe der Segmente, die in dieses Fenster fallen.

### Bucket-Grösse wählen (`timeSeriesBuckets.ts`)

| Sichtbarer Zeitraum | Bucket |
|---------------------|--------|
| ≤ 45 min | 1 min |
| ≤ 3 h | 2 min |
| ≤ 8 h | 5 min |
| 24 h | **15 min** |

Frontend berechnet `bucketSeconds`, Backend aggregiert.

### Tooltip vs. X-Achse (häufige Verwechslung)

| Anzeige | Was es ist |
|---------|------------|
| **Zeitfenster: 01:00** | Start eines **15-Minuten-Rasters** |
| **VS Code: 2 min 0 s** | Geschätzte **aktive** Zeit in diesem Raster für diese Kategorie |

Die 15 Minuten sind **nicht** „du warst 15 Minuten in VS Code“.

---

## 5. Serverseitige Paginierung

```tsx
invoke("get_activities_page", { projectId, page: 2, pageSize: 20 });
```

| Vorteil | Erklärung |
|---------|-----------|
| Wenig RAM im Frontend | Nur 20 Zeilen, nicht 20'000 |
| Schnelle UI | SQL `LIMIT` / `OFFSET` in Rust |

`tableRevision` sagt der Tabelle: „Seite neu laden“.

---

## 6. Demo-Daten (`seed-database`)

Separates Tool füllt `rustime.db` mit realistischen 2-Sekunden-Samples in Arbeitsblöcken (24 h).  
Siehe [../TEST-DATENBANK.md](../TEST-DATENBANK.md).

---

## Merksatz

**Speichern** (2 s Samples) ≠ **Anzeigen** (Segmente, Buckets, Top-N).  
Die Charts sind **Auswertung**, nicht 1:1-Rohtracking.

Nächstes Kapitel: [04-architektur-schichten.md](./04-architektur-schichten.md)
