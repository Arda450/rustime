import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parseWindowContext, formatContextLabel } from "../utils/WindowContext";
import reactLogo from "../assets/react.svg";

type Activity = { title: string; timestamp: number };

type BackendApiError = {
  code?: string;
  message?: string;
};

function parseApiError(err: unknown): { code?: string; message: string } {
  // Tauri wirft oft Error-Objekte, manchmal Strings
  if (typeof err === "string") {
    // Versuch: JSON-String mit { code, message }
    try {
      const parsed = JSON.parse(err) as BackendApiError;
      if (parsed?.message) {
        return { code: parsed.code, message: parsed.message };
      }
    } catch {
      return { message: err };
    }
    return { message: err };
  }
  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    // Häufiges Tauri-Format: { code, message }
    if (typeof anyErr.message === "string") {
      return {
        code: typeof anyErr.code === "string" ? anyErr.code : undefined,
        message: anyErr.message,
      };
    }
    // Falls error-string in anderem Feld steckt
    if (typeof anyErr.error === "string") {
      return { message: anyErr.error };
    }
  }
  return { message: "Unbekannter Fehler" };
}
function toUserMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "DB_LOCK_FAILED":
      return "Datenbank ist aktuell gesperrt. Bitte erneut versuchen.";
    case "DB_READ_FAILED":
    case "DB_SQL_FAILED":
      return "Daten konnten nicht gelesen werden.";
    case "DB_IO_FAILED":
      return "Dateizugriff fehlgeschlagen.";
    case "APP_DIR_NOT_FOUND":
      return "Dokumente-Ordner wurde nicht gefunden.";
    case "WINDOW_NOT_FOUND":
      return "Kein aktives Fenster erkannt.";
    case "WINDOW_TITLE_EMPTY":
      return "Fenstertitel war leer.";
    case "JSON_SERIALIZE_FAILED":
      return "Export konnte nicht erstellt werden.";
    default:
      return fallback;
  }
}

function OverviewPanel() {
  const [exportMsg, setExportMsg] = useState("");
  const [exportPreview, setExportPreview] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isTracking, setIsTracking] = useState(false); // zeigt ob tracking läuft oder nicht
  const [activities, setActivities] = useState<Activity[]>([]);

  async function exportJsonToDownloads() {
    try {
      const path = await invoke<string>("export_activities_json_to_downloads");
      setExportMsg(`Export erfolgreich: ${path}`);
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `Export fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    }
  }

  async function PreviewJsonUi() {
    try {
      setIsExporting(true);
      setExportMsg("");

      const json = await invoke<string>("show_activities_json");

      // JSON validieren + optional schön formatieren
      const parsed = JSON.parse(json);
      const pretty = JSON.stringify(parsed, null, 2);

      setExportPreview(pretty);
      setExportMsg(
        `Export erfolgreich (${Array.isArray(parsed) ? parsed.length : "?"} Einträge)`,
      );
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `Export fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function startTracking() {
    try {
      await invoke("start_tracking");
      setIsTracking(true);
      setExportMsg("");
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `Start fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    }
  }

  async function stopTracking() {
    try {
      await invoke("stop_tracking");
      setIsTracking(false);
      setExportMsg("");
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `Stop fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    }
  }

  // ladet daten vom backend und aktualisiert die activities liste
  useEffect(() => {
    const unlisten = listen<Activity>("new-activity", (event) => {
      setActivities((prev) => [...prev, event.payload]);
    });

    // Cleanup
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []); //leeres array, nur beim ersten render ausführen

  return (
    <main className="container">
      {/* Tracking Controls */}
      <div style={{ marginTop: "20px" }}>
        <h2>Tracking</h2>
        {!isTracking ? (
          <button onClick={startTracking}>▶ Start Tracking</button>
        ) : (
          <button onClick={stopTracking}>⏹ Stop Tracking</button>
        )}
        <p>Status: {isTracking ? "Läuft..." : "Gestoppt"}</p>
      </div>

      {/* Aktivitäten-Liste */}
      <div style={{ marginTop: "20px" }}>
        <h3>Erfasste Fenster ({activities.length})</h3>
        <ul style={{ textAlign: "left", maxHeight: "200px", overflow: "auto" }}>
          {activities.map((activity, index) => {
            const parsed = parseWindowContext(activity.title);
            const label = formatContextLabel(parsed);

            return (
              <li key={index}>
                {new Date(activity.timestamp * 1000).toLocaleTimeString()}:{" "}
                {label}
                {parsed.raw && parsed.raw !== label ? ` (${parsed.raw})` : ""}
              </li>
            );
          })}
        </ul>
      </div>

      <button onClick={PreviewJsonUi} disabled={isExporting}>
        {isExporting ? "Lade Vorschau..." : "JSON in UI anzeigen"}
      </button>
      <p>{exportMsg}</p>
      <pre style={{ maxHeight: 220, overflow: "auto", textAlign: "left" }}>
        {exportPreview}
      </pre>

      <button onClick={exportJsonToDownloads} disabled={isExporting}>
        {isExporting ? "Export läuft..." : "JSON in Downloads speichern"}
      </button>
    </main>
  );
}

export default OverviewPanel;
