import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import type { OverviewStats } from "../types";
import {
  buildChartLegendEntries,
  mergeCategoryOrder,
} from "../utils/chartLegend";
import { formatDurationSeconds } from "../utils/formatDuration";
import { formatBucketLabel } from "../utils/timeSeriesBuckets";
import { apiErrorMessage } from "../utils/apiError";
import ActivityPieChart from "./charts/PieChart";
import ChartLegend from "./charts/ChartLegend";
import TimeSeriesChart from "./charts/TimeSeriesChart";
import { PanelDialog } from "./PanelDialog";

type AppOverviewDialogProps = {
  open: boolean;
  dwellRevision: number;
  onOpenChange: (open: boolean) => void;
};

type ChartMode = "pie" | "timeseries";
const BUCKET_SECONDS = 15 * 60;

export function AppOverviewDialog({
  open,
  dwellRevision,
  onOpenChange,
}: AppOverviewDialogProps) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("pie");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");

    invoke<OverviewStats>("get_overview_stats")
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((reason) => {
        console.error("overview stats load failed", reason);
        if (!cancelled) {
          setError(
            apiErrorMessage(
              reason,
              "Die App-Statistiken konnten nicht geladen werden.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, dwellRevision]);

  const categoryOrder = useMemo(
    () =>
      stats
        ? mergeCategoryOrder(
            stats.by_project.map((project) => project.name),
            stats.by_project,
            stats.timeline,
          )
        : [],
    [stats],
  );
  const legendEntries = useMemo(
    () =>
      stats
        ? buildChartLegendEntries(
            categoryOrder,
            chartMode,
            stats.by_project,
            stats.timeline,
          )
        : [],
    [categoryOrder, chartMode, stats],
  );
  const mostActiveProject = stats?.by_project.find(
    (project) => project.name !== "Sonstige",
  );

  return (
    <PanelDialog open={open} title="App-Übersicht" onOpenChange={onOpenChange}>
      <section className="appOverview">
        <div>
          <h2>App-Statistik aller Projekte</h2>
          <p className="appOverviewSubtitle">
            Geschätzte Gesamtwerte seit Beginn der Erfassung. Pro Minute wird
            die überwiegend genutzte App berücksichtigt.
          </p>
        </div>

        {error ? (
          <p className="overviewLoadError">{error}</p>
        ) : !stats ? (
          <OverviewSkeleton />
        ) : (
          <>
            <div className="overviewStatCards" aria-label="App-Statistiken">
              <article>
                <span>Insgesamt gearbeitet</span>
                <strong>
                  {formatDurationSeconds(stats.total_active_seconds)}
                </strong>
              </article>
              <article>
                <span>Heute gearbeitet</span>
                <strong>
                  {formatDurationSeconds(stats.today_active_seconds)}
                </strong>
              </article>
              <article>
                <span>Projekte</span>
                <strong>{stats.project_count}</strong>
              </article>
              <article>
                <span>Aktive Tage</span>
                <strong>{stats.active_days}</strong>
              </article>
            </div>

            {stats.activity_count > 0 && (
              <div className="overviewInsights">
                <span>
                  Aktivstes Projekt:{" "}
                  <strong>{mostActiveProject?.name ?? "–"}</strong>
                </span>
                <span>
                  Erfasst seit:{" "}
                  <strong>
                    {stats.first_activity_ts
                      ? new Date(
                          stats.first_activity_ts * 1000,
                        ).toLocaleDateString("de-CH")
                      : "–"}
                  </strong>
                </span>
                <span>
                  Gespeicherte Einträge:{" "}
                  <strong>
                    {stats.activity_count.toLocaleString("de-CH")}
                  </strong>
                </span>
              </div>
            )}

            <div
              className="chartModeSwitch"
              role="group"
              aria-label="Darstellung der Gesamtstatistik"
            >
              <button
                type="button"
                className={chartMode === "pie" ? "active" : ""}
                aria-pressed={chartMode === "pie"}
                onClick={() => setChartMode("pie")}
              >
                Gesamtverteilung
              </button>
              <button
                type="button"
                className={chartMode === "timeseries" ? "active" : ""}
                aria-pressed={chartMode === "timeseries"}
                onClick={() => setChartMode("timeseries")}
              >
                Verlauf (24 Stunden)
              </button>
            </div>

            <p className="overviewChartHint">
              {chartMode === "pie"
                ? "Gesamte erfasste Arbeitszeit, aufgeteilt nach Projekten."
                : `Aktive Projektzeit pro ${formatBucketLabel(BUCKET_SECONDS)}-Fenster.`}
            </p>

            <div className="chartWithSharedLegend">
              <div className="chartPane">
                {chartMode === "pie" ? (
                  <ActivityPieChart
                    data={stats.by_project}
                    categoryOrder={categoryOrder}
                    emptyHint="Es wurden noch keine Projektzeiten erfasst."
                  />
                ) : (
                  <TimeSeriesChart
                    data={stats.timeline}
                    categoryOrder={categoryOrder}
                    bucketSeconds={BUCKET_SECONDS}
                    emptyHint="In den letzten 24 Stunden liegen keine Daten vor."
                  />
                )}
              </div>
              <ChartLegend
                entries={legendEntries}
                viewLabel={
                  chartMode === "pie"
                    ? "Anteil an der gesamten Arbeitszeit"
                    : "Projektzeiten der letzten 24 Stunden"
                }
              />
            </div>
          </>
        )}
      </section>
    </PanelDialog>
  );
}

function OverviewSkeleton() {
  return (
    <div className="chartSkeleton" role="status" aria-label="Übersicht laden">
      <span className="chartSkeletonToggle" />
      <span className="chartSkeletonPlot" />
      <span className="chartSkeletonLegend" />
    </div>
  );
}
