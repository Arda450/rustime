import { useState, useEffect } from "react";
// import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parseWindowContext, formatContextLabel } from "../utils/WindowContext";

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
  // const [greetMsg, setGreetMsg] = useState("");
  // const [name, setName] = useState("");
  // const [windowTitle, setWindowTitle] = useState("");
  const [isTracking, setIsTracking] = useState(false); // zeigt ob tracking läuft oder nicht
  const [activities, setActivities] = useState<Activity[]>([]);

  // async function greet() {
  //   setGreetMsg(await invoke("greet", { name }));
  // }

  async function exportJson() {
    try {
      setIsExporting(true);
      setExportMsg("");

      const json = await invoke<string>("export_activities_json");

      // JSON validieren + optional schoen formatieren
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

  // async function getWindowTitle() {
  //   try {
  //     const title = await invoke<string>("get_current_window");
  //     setWindowTitle(title);
  //     setExportMsg("");
  //   } catch (e) {
  //     const parsed = parseApiError(e);
  //     setExportMsg(
  //       `Fenstertitel holen fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
  //     );
  //   }
  // }

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
      {/* <h1>Welcome to Tauri + React</h1> */}

      {/* <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        78
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greeargergherqget</button>
      </form> */}
      {/* <p>{greetMsg}</p> */}
      {/* <button onClick={getWindowTitle}>Fenstertitel holen</button>
      <p>{windowTitle}</p> */}

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

      <button onClick={exportJson} disabled={isExporting}>
        {isExporting ? "Export läuft..." : "Export JSON"}
      </button>
      <p>{exportMsg}</p>
      <pre style={{ maxHeight: 220, overflow: "auto", textAlign: "left" }}>
        {exportPreview}
      </pre>
    </main>
  );
}

export default OverviewPanel;
