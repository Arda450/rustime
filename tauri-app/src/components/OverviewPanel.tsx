import { invoke } from "@tauri-apps/api/core";
import { Project } from "../types";
import { ProjectPickerButton } from "./ProjectPickerButton";
import { useProjectPicker } from "../hooks/useProjectPicker";
import { useEffect, useState } from "react";
import ActivityPieChart from "./charts/PieChart";
import type { PieSegment } from "./charts/PieChart";
import { ActivitiesTable } from "./ActivitiesTable";

type OverviewPanelProps = {
  isTracking: boolean;
  onStartTracking: () => Promise<void> | void;
  onStopTracking: () => Promise<void> | void;
  statusError?: string | null;
  activeProject: Project | null;
  activityCount: number;
  tableRevision: number;
  dwellRevision: number;
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
  activityCount,
  tableRevision,
  dwellRevision,
  onProjectSelected,
}: OverviewPanelProps) {
  const [exportMsg, setExportMsg] = useState("");
  const [exportPreview, setExportPreview] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [dwellSegments, setDwellSegments] = useState<PieSegment[]>([]);

  const { pickProject, isPicking, error, clearError } = useProjectPicker({
    onProjectSelected,
  });

  useEffect(() => {
    if (!activeProject) {
      setDwellSegments([]);
      return;
    }

    let cancelled = false;

    invoke<PieSegment[]>("get_dwell_by_category", {
      projectId: activeProject.id,
      maxSegmentGapSeconds: 120,
      tailSeconds: 2,
      topN: 10,
    })
      .then((segments) => {
        if (!cancelled) setDwellSegments(segments);
      })
      .catch((e) => console.error("get_dwell_by_category failed", e));

    return () => {
      cancelled = true;
    };
  }, [activeProject, dwellRevision]);

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

  const tableProjectId = activeProject?.id ?? null;

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
        {activityCount === 0 ? (
          <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
            Noch keine Aktivitäten erfasst. Starte das Tracking, um Fenster zu
            erfassen.
          </p>
        ) : (
          <div style={{ marginTop: "20px" }}>
            <h3>Erfasste Fenster</h3>
            <ActivitiesTable
              projectId={tableProjectId}
              refreshKey={tableRevision}
            />
          </div>
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
          disabled={isExporting || activityCount === 0}
        >
          {isExporting ? "Lade Vorschau..." : "JSON in UI anzeigen"}
        </button>

        <button
          onClick={exportJsonToDownloads}
          disabled={isExporting || activityCount === 0}
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

      <div style={{ marginTop: "20px" }}>
        <h3>Zeitverteilung (aktives Projekt)</h3>
        <p
          style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 8 }}
        >
          Geschätzte Verweildauer pro Kategorie aus den Samples (nicht jede
          einzelne Aktivität). Wechselt automatisch mit dem aktiven Projekt.
        </p>
        {!activeProject ? (
          <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
            Projekt wählen, um das Diagramm zu sehen.
          </p>
        ) : (
          <ActivityPieChart
            data={dwellSegments}
            emptyHint="Für dieses Projekt liegen noch keine Aktivitäten vor."
          />
        )}
      </div>
    </section>
  );
}

export default OverviewPanel;
