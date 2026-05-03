import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseWindowContext, formatContextLabel } from "../utils/WindowContext";
import { Activity, Project } from "../types";
import { ProjectPickerButton } from "./ProjectPickerButton";
import { useProjectPicker } from "../hooks/useProjectPicker";

type OverviewPanelProps = {
  isTracking: boolean;
  onStartTracking: () => Promise<void> | void;
  onStopTracking: () => Promise<void> | void;
  statusError?: string | null;
  activeProject: Project | null;
  activities: Activity[];
  onProjectSelected: (project: Project) => void;
};

type BackendApiError = {
  code?: string;
  message?: string;
};

function parseApiError(err: unknown): { code?: string; message: string } {
  if (typeof err === "string") {
    try {
      const parsed = JSON.parse(err) as BackendApiError;
      if (parsed?.message)
        return { code: parsed.code, message: parsed.message };
    } catch {
      return { message: err };
    }
    return { message: err };
  }

  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    if (typeof anyErr.message === "string") {
      return {
        code: typeof anyErr.code === "string" ? anyErr.code : undefined,
        message: anyErr.message,
      };
    }
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

function OverviewPanel({
  isTracking,
  onStartTracking,
  onStopTracking,
  statusError,
  activeProject,
  activities,
  onProjectSelected,
}: OverviewPanelProps) {
  const [exportMsg, setExportMsg] = useState("");
  const [exportPreview, setExportPreview] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { pickProject, isPicking, error, clearError } = useProjectPicker({
    onProjectSelected,
  });

  async function chooseProjectFromOverview() {
    clearError();
    await pickProject();
  }

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

  async function previewJsonUi() {
    try {
      setIsExporting(true);
      setExportMsg("");

      const json = await invoke<string>("show_activities_json");
      const parsed = JSON.parse(json);
      const pretty = JSON.stringify(parsed, null, 2);

      setExportPreview(pretty);
      const count =
        parsed?.activities?.length ??
        (Array.isArray(parsed) ? parsed.length : "?");
      setExportMsg(`Export erfolgreich (${count} Einträge)`);
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `Export fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="container">
      <h2>Tracking</h2>

      {activeProject ? (
        <p style={{ marginBottom: "12px", color: "var(--accent)" }}>
          Projekt: <strong>{activeProject.name}</strong>
        </p>
      ) : (
        <p style={{ marginBottom: "12px", color: "var(--warning)" }}>
          Bitte zuerst ein Projekt wählen.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {!activeProject && (
          <ProjectPickerButton
            onPick={chooseProjectFromOverview}
            loading={isPicking}
          />
        )}

        {!isTracking ? (
          <button onClick={onStartTracking} disabled={!activeProject}>
            ▶ Start Tracking
          </button>
        ) : (
          <button onClick={onStopTracking}>⏹ Stop Tracking</button>
        )}
      </div>

      {error && (
        <p style={{ marginTop: "8px", color: "var(--danger)" }}>{error}</p>
      )}

      <p style={{ marginTop: "12px" }}>
        Status: {isTracking ? "Läuft..." : "Gestoppt"}
      </p>
      {statusError && (
        <p style={{ marginTop: 8, color: "red" }}>{statusError}</p>
      )}

      <div style={{ marginTop: "20px" }}>
        <h3>Erfasste Fenster ({activities.length})</h3>
        {activities.length === 0 ? (
          <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
            Noch keine Aktivitäten erfasst. Starte das Tracking, um Fenster zu
            erfassen.
          </p>
        ) : (
          <ul
            style={{ textAlign: "left", maxHeight: "200px", overflow: "auto" }}
          >
            {activities.map((activity, index) => {
              const parsed = parseWindowContext(activity.title);
              const label = formatContextLabel(parsed);

              return (
                <li key={index}>
                  {new Date(activity.timestamp * 1000).toLocaleTimeString()}:{" "}
                  {label}
                  {parsed.raw && parsed.raw !== label ? ` (${parsed.raw})` : ""}
                  {activity.project_name && (
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>
                      [{activity.project_name}]
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "16px",
        }}
      >
        <button
          onClick={previewJsonUi}
          disabled={isExporting || activities.length === 0}
        >
          {isExporting ? "Lade Vorschau..." : "JSON in UI anzeigen"}
        </button>

        <button
          onClick={exportJsonToDownloads}
          disabled={isExporting || activities.length === 0}
        >
          {isExporting ? "Export läuft..." : "JSON in Downloads speichern"}
        </button>
      </div>

      {exportMsg && <p style={{ marginTop: "12px" }}>{exportMsg}</p>}

      {exportPreview && (
        <pre
          style={{
            maxHeight: 220,
            overflow: "auto",
            textAlign: "left",
            marginTop: "12px",
          }}
        >
          {exportPreview}
        </pre>
      )}
    </section>
  );
}

export default OverviewPanel;
