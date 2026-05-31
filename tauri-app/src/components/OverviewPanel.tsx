import { invoke } from "@tauri-apps/api/core";

import { CategoryTimeSeriesPoint, Project } from "../types";

import { ProjectPickerButton } from "./ProjectPickerButton";

import { useProjectPicker } from "../hooks/useProjectPicker";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import ActivityPieChart from "./charts/PieChart";

import type { PieSegment } from "./charts/PieChart";

import TimeSeriesChart from "./charts/TimeSeriesChart";

import ChartLegend from "./charts/ChartLegend";

import { ActivitiesTable } from "./ActivitiesTable";

import {
  buildChartLegendEntries,
  mergeCategoryOrder,
} from "../utils/chartLegend";

import {
  chooseBucketSeconds,
  formatBucketLabel,
} from "../utils/timeSeriesBuckets";

import { Play, Square, X } from "lucide-react";
import { AppIcon } from "./Icon";

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

type ChartView = "pie" | "timeseries";

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

const CHART_OPTS = {
  maxSegmentGapSeconds: 120,
  tailSeconds: 2,
  topN: 10,
} as const;

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
  const [chartView, setChartView] = useState<ChartView>("pie");
  const [dwellSegments, setDwellSegments] = useState<PieSegment[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [timeSeriesByCategory, setTimeSeriesByCategory] = useState<
    CategoryTimeSeriesPoint[]
  >([]);

  const [chartsEverLoaded, setChartsEverLoaded] = useState(false);
  const [isRefreshingCharts, setIsRefreshingCharts] = useState(false);
  const chartsLoadedRef = useRef(false);
  const [timeSeriesBucketSeconds, setTimeSeriesBucketSeconds] = useState(120);
  const { pickProject, isPicking, error, clearError } = useProjectPicker({
    onProjectSelected,
  });

  const projectId = activeProject?.id ?? null;

  useEffect(() => {
    if (projectId == null) {
      setDwellSegments([]);
      setCategoryOrder([]);
      setTimeSeriesByCategory([]);
      setChartsEverLoaded(false);
      setIsRefreshingCharts(false);
      chartsLoadedRef.current = false;
      return;
    }

    let cancelled = false;

    if (chartsLoadedRef.current) {
      setIsRefreshingCharts(true);
    }

    const now = Math.floor(Date.now() / 1000);
    const fromTs = now - 3 * 60 * 60;
    const bucketSeconds = chooseBucketSeconds(now - fromTs);
    setTimeSeriesBucketSeconds(bucketSeconds);

    Promise.all([
      invoke<PieSegment[]>("get_dwell_by_category", {
        projectId,

        ...CHART_OPTS,
      }),

      invoke<CategoryTimeSeriesPoint[]>("get_time_series_by_category", {
        projectId,
        fromTs,
        toTs: now,
        bucketSeconds,
        maxSegmentGapSeconds: CHART_OPTS.maxSegmentGapSeconds,
        tailSeconds: CHART_OPTS.tailSeconds,
      }),
    ])

      .then(([segments, points]) => {
        if (cancelled) return;
        setDwellSegments(segments);
        setTimeSeriesByCategory(points);
        setCategoryOrder(
          mergeCategoryOrder(
            segments.map((s) => s.name),
            segments,
            points,
          ),
        );
        chartsLoadedRef.current = true;
        setChartsEverLoaded(true);
      })

      .catch((e) => console.error("chart data load failed", e))

      .finally(() => {
        if (!cancelled) setIsRefreshingCharts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, dwellRevision]);

  const legendEntries = useMemo(
    () =>
      buildChartLegendEntries(
        categoryOrder,
        chartView,
        dwellSegments,
        timeSeriesByCategory,
      ),
    [categoryOrder, chartView, dwellSegments, timeSeriesByCategory],
  );

  const legendHint =
    chartView === "pie"
      ? "Anteil an der Gesamtzeit"
      : "Summe im sichtbaren Zeitraum";

  const showChartArea =
    activeProject != null &&
    (chartsEverLoaded ||
      dwellSegments.length > 0 ||
      timeSeriesByCategory.length > 0);

  const chartEmptyHint =
    chartView === "pie"
      ? "Für dieses Projekt liegen noch keine Aktivitäten vor."
      : "Für dieses Projekt liegen noch keine Zeitverlaufsdaten vor.";

  async function chooseProjectFromOverview() {
    clearError();
    await pickProject();
  }

  async function exportJsonToDownloads() {
    try {
      const path = await invoke<string>("export_activities_json_to_downloads");
      setExportMsg(`JSON-Export erfolgreich: ${path}`);
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `JSON-Export fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    }
  }

  async function exportCsvToDownloads() {
    try {
      setIsExporting(true);
      setExportMsg("");
      const path = await invoke<string>("export_activities_csv_to_downloads");
      setExportMsg(`CSV-Export erfolgreich: ${path}`);
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `CSV-Export fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    } finally {
      setIsExporting(false);
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
      setExportMsg(`(${count} JSON-Einträge)`);
    } catch (e) {
      const parsed = parseApiError(e);
      setExportMsg(
        `JSON-Anzeige fehlgeschlagen: ${toUserMessage(parsed.code, parsed.message)}`,
      );
    } finally {
      setIsExporting(false);
    }
  }

  function closeJsonPreview() {
    setExportPreview("");
  }

  const tableProjectId = activeProject?.id ?? null;

  return (
    <section className="overviewPanel">
      <header className="overviewHeader">
        <h2>Tracking</h2>
        {activeProject ? (
          <p style={{ margin: 0, color: "var(--accent)" }}>
            Aktives Projekt: <strong>{activeProject.name}</strong>
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--warning)" }}>
            Bitte zuerst ein Projekt wählen.
          </p>
        )}

        <div className="overviewHeaderActions">
          {!activeProject && (
            <ProjectPickerButton
              onPick={chooseProjectFromOverview}
              loading={isPicking}
            />
          )}

          {!isTracking ? (
            <button
              type="button"
              onClick={onStartTracking}
              disabled={!activeProject}
            >
              <AppIcon icon={Play} size={16} />
              <span>Starte Tracking</span>
            </button>
          ) : (
            <button type="button" onClick={onStopTracking}>
              <AppIcon icon={Square} size={16} />
              <span>Stopp Tracking</span>
            </button>
          )}
        </div>

        {error && <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>}

        <p style={{ margin: 0 }}>
          Status: <strong>{isTracking ? "Aktiv" : "Inaktiv"}</strong>
        </p>
        {statusError && (
          <p style={{ margin: 0, color: "red" }}>{statusError}</p>
        )}
      </header>

      <div className="overviewColumns">
        <div className="overviewColumn overviewColumnLeft">
          <h3>Erfasste Fenster</h3>

          {activityCount === 0 ? (
            <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
              Noch keine Aktivitäten erfasst. Starte das Tracking, um Fenster zu
              erfassen.
            </p>
          ) : (
            <ActivitiesTable
              projectId={tableProjectId}
              refreshKey={tableRevision}
            />
          )}

          <div className="overviewExportActions">
            <button
              type="button"
              onClick={exportJsonToDownloads}
              disabled={isExporting || activityCount === 0}
            >
              {isExporting ? "Export läuft..." : "JSON in Downloads speichern"}
            </button>

            <button
              type="button"
              onClick={exportCsvToDownloads}
              disabled={isExporting || activityCount === 0}
            >
              {isExporting ? "Export läuft..." : "CSV in Downloads speichern"}
            </button>

            <button
              type="button"
              onClick={previewJsonUi}
              disabled={isExporting || activityCount === 0}
            >
              {isExporting ? "Lade Vorschau..." : "JSON in UI anzeigen"}
            </button>
          </div>

          {exportMsg && <p style={{ margin: 0 }}>{exportMsg}</p>}

          {exportPreview && (
            <div className="overviewExportPreviewWrap">
              <button
                type="button"
                className="overviewExportPreviewClose"
                onClick={closeJsonPreview}
              >
                <AppIcon icon={X} size={16} />
              </button>
              <pre className="overviewExportPreview">{exportPreview}</pre>
            </div>
          )}
        </div>

        <div className="overviewColumn overviewColumnRight">
          <h3>Auswertung (aktives Projekt)</h3>

          <div
            className="chartViewSwitch"
            role="tablist"
            aria-label="Diagrammtyp"
          >
            <ChartViewButton
              active={chartView === "pie"}
              onClick={() => setChartView("pie")}
            >
              Zeitverteilung
            </ChartViewButton>
            <ChartViewButton
              active={chartView === "timeseries"}
              onClick={() => setChartView("timeseries")}
            >
              Zeitverlauf
            </ChartViewButton>
          </div>

          {!activeProject ? (
            <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
              Projekt wählen, um ein Diagramm zu sehen.
            </p>
          ) : !showChartArea ? (
            <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
              Lade Diagrammdaten…
            </p>
          ) : (
            <>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  margin: "0 0 8px",
                }}
              >
                {chartView === "pie"
                  ? "Geschätzte Verweildauer pro Kategorie aus den Samples."
                  : `Aktive Zeit pro ${formatBucketLabel(timeSeriesBucketSeconds)}-Fenster, ab der ersten erfassten Aktivität.`}
              </p>

              <div className="chartWithSharedLegend">
                <div
                  className={`chartPane${isRefreshingCharts ? " chartPaneRefreshing" : ""}`}
                >
                  {chartView === "pie" ? (
                    <ActivityPieChart
                      data={dwellSegments}
                      categoryOrder={categoryOrder}
                      emptyHint={chartEmptyHint}
                    />
                  ) : (
                    <TimeSeriesChart
                      data={timeSeriesByCategory}
                      categoryOrder={categoryOrder}
                      bucketSeconds={timeSeriesBucketSeconds}
                      emptyHint={chartEmptyHint}
                    />
                  )}
                </div>

                <ChartLegend entries={legendEntries} viewLabel={legendHint} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

type ChartViewButtonProps = {
  active: boolean;

  onClick: () => void;

  children: ReactNode;
};

function ChartViewButton({ active, onClick, children }: ChartViewButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`chartViewBtn${active ? " chartViewBtnActive" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default OverviewPanel;
