//! CLI: Demo-Datenbank für Rustime erzeugen.
//!
//! Beispiel:
//!   cargo run -p seed-database
//!   cargo run -p seed-database -- --days 3
//!   cargo run -p seed-database -- --output ../../testdata/rustime-demo.db

use std::env;
use std::path::PathBuf;
use std::process;

use chrono::Local;
use rustime_db::{default_database_path, open_database, seed_demo_data, SeedOptions, SeedTimeMode};

fn print_usage() {
    eprintln!(
        r#"Rustime Demo-Datenbank befüllen (2s-Polling in Arbeitsblöcken)

Verwendung:
  cargo run -p seed-database -- [OPTIONEN]

Optionen:
  --days N        N Kalendertage (heute + vergangene Tage) — empfohlen für Tagesberichte
  --hours N       Rollierendes Fenster in Stunden (Standard: 24, wenn --days fehlt)
  --no-clear      Bestehende Daten nicht löschen
  --output PATH   Zieldatei (Standard: Dokumente/rustime-data/rustime.db)

Beispiele:
  cargo run -p seed-database -- --days 3
  cargo run -p seed-database -- --hours 12
  cargo run -p seed-database -- --output testdata/rustime-demo.db

UI-Test: App beenden, Seed ausführen, App starten, Projekt „rustime“ wählen.
"#
    );
}

fn parse_args() -> Result<(PathBuf, SeedOptions), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut output: Option<PathBuf> = None;
    let mut opts = SeedOptions::default();
    let mut calendar_days: Option<u64> = None;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--help" | "-h" => {
                print_usage();
                process::exit(0);
            }
            "--days" => {
                i += 1;
                calendar_days = Some(
                    args.get(i)
                        .ok_or("--days braucht eine Zahl")?
                        .parse()
                        .map_err(|_| "Ungültige Zahl bei --days")?,
                );
            }
            "--hours" => {
                i += 1;
                let hours = args
                    .get(i)
                    .ok_or("--hours braucht eine Zahl")?
                    .parse()
                    .map_err(|_| "Ungültige Zahl bei --hours")?;
                opts.time_mode = SeedTimeMode::RollingHours(hours);
            }
            "--no-clear" => opts.clear_existing = false,
            "--output" => {
                i += 1;
                output = Some(
                    args.get(i)
                        .ok_or("--output braucht einen Pfad")?
                        .into(),
                );
            }
            "--count" => {
                return Err(
                    "„--count“ gibt es nicht mehr; nutze --days 3 oder --hours 24.".to_string(),
                );
            }
            other => return Err(format!("Unbekanntes Argument: {other}")),
        }
        i += 1;
    }

    if let Some(days) = calendar_days {
        opts.time_mode = SeedTimeMode::CalendarDays(days.max(1));
    }

    let path = match output {
        Some(p) => p,
        None => default_database_path().map_err(|e| e.to_string())?,
    };

    Ok((path, opts))
}

fn main() {
    let (path, opts) = match parse_args() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Fehler: {e}\n");
            print_usage();
            process::exit(1);
        }
    };

    let conn = match open_database(&path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Datenbank konnte nicht geöffnet werden: {e}");
            process::exit(1);
        }
    };

    let report = match seed_demo_data(&conn, &opts) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Seed fehlgeschlagen: {e}");
            process::exit(1);
        }
    };

    println!("Demo-Datenbank erstellt (realistisch: 2s-Samples in Arbeitsblöcken).");
    println!("  Pfad:              {}", path.display());
    println!("  Projekte:          {}", report.projects_created);
    println!("  Aktivitäten:       {}", report.activities_inserted);
    if let Some(days) = report.calendar_days {
        println!(
            "  Zeitraum:          {} Kalendertage (lokal), Unix {} .. {}",
            days, report.from_ts, report.to_ts
        );
        println!("  Tagesbericht:      Tab „Tagesbericht“ → heute / gestern testen");
    } else {
        println!(
            "  Zeitraum:          letzte {} h (Unix {} .. {})",
            opts.hours_back(),
            report.from_ts,
            report.to_ts
        );
    }
    println!(
        "  Polling-Intervall: {} s (wie echtes Tracking)",
        report.poll_interval_seconds
    );
    println!(
        "  Lokales Datum:     {}",
        Local::now().format("%d.%m.%Y")
    );
    println!();
    println!("Nächste Schritte für UI-Test:");
    println!("  1. Rustime-App vollständig beenden (auch tauri dev)");
    println!("  2. App neu starten: npm run tauri dev");
    println!("  3. Tab „Projekte“ → „rustime“ als aktiv setzen");
    println!("  4. Übersicht → Tagesbericht / Pie / Zeitverlauf");
}
