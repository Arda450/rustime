import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CategoryTimeSeriesPoint, DailyReport } from "../types";
import {
  addDaysIso,
  dateInputToFromTs,
  dateInputToToTs,
  formatIsoDateLong,
  formatTimeFromTs,
  todayIsoDate,
} from "../utils/dateRange";
import { formatDurationSeconds } from "../utils/formatDuration";
import {
  buildChartLegendEntries,
  mergeCategoryOrder,
} from "../utils/chartLegend";
import { formatBucketLabel } from "../utils/timeSeriesBuckets";
import ActivityPieChart from "./charts/PieChart";
import type { PieSegment } from "./charts/PieChart";
import TimeSeriesChart from "./charts/TimeSeriesChart";
import ChartLegend from "./charts/ChartLegend";
import { AppIcon } from "./Icon";

const REPORT_OPTS = {
  maxSegmentGapSeconds: 120,
  tailSeconds: 2,
} as const;

const TIMELINE_BUCKET_SECONDS = 900;

type Props = {
  projectId: number;
  projectName: string;
  dwellRevision: number;
  onShowInTable: (isoDate: string) => void;
};

export function DailyReportView({
  projectId,
  projectName,
  dwellRevision,
  onShowInTable,
}: Props) {
  const [reportDate, setReportDate] = useState(todayIsoDate);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fromTs = dateInputToFromTs(reportDate);
    const toTs = dateInputToToTs(reportDate);

    invoke<DailyReport>("get_daily_report", {
      projectId,
      date: reportDate,
      fromTs,
      toTs,
      ...REPORT_OPTS,
    })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e) => {
        console.error("get_daily_report failed", e);
        if (!cancelled) {
          setReport(null);
          setError("Tagesbericht konnte nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, reportDate, dwellRevision]);

  const pieSegments: PieSegment[] = useMemo(
    () =>
      (report?.by_category ?? []).map((s) => ({
        name: s.name,
        value: s.value,
      })),
    [report?.by_category],
  );

  const timeline: CategoryTimeSeriesPoint[] = report?.timeline ?? [];

  const categoryOrder = useMemo(
    () =>
      mergeCategoryOrder(
        pieSegments.map((s) => s.name),
        pieSegments,
        timeline,
      ),
    [pieSegments, timeline],
  );

  const legendEntries = useMemo(
    () =>
      buildChartLegendEntries(
        categoryOrder,
        "timeseries",
        pieSegments,
        timeline,
      ),
    [categoryOrder, pieSegments, timeline],
  );

  const summaryLine = useMemo(() => {
    if (!report || report.sample_count === 0) return null;
    const parts: string[] = [];
    if (report.first_activity_ts != null && report.last_activity_ts != null) {
      parts.push(
        `Erfasst von ${formatTimeFromTs(report.first_activity_ts)} bis ${formatTimeFromTs(report.last_activity_ts)}`,
      );
    }
    parts.push(
      `${report.sample_count} Sample${report.sample_count === 1 ? "" : "s"}`,
    );
    parts.push(`ca. ${formatDurationSeconds(report.total_active_seconds)} aktiv`);
    return parts.join(" · ");
  }, [report]);

  function shiftDay(delta: number) {
    setReportDate((d) => addDaysIso(d, delta));
  }

  const isEmpty = report != null && report.sample_count === 0;

  return (
    <div className="dailyReport">
      <div className="dailyReportNav">
        <button
          type="button"
          className="dailyReportNavBtn"
          onClick={() => shiftDay(-1)}
          aria-label="Vorheriger Tag"
        >
          <AppIcon icon={ChevronLeft} size={18} />
        </button>
        <label className="dailyReportDateField">
          <span className="dailyReportDateLabel">Bericht für</span>
          <input
            type="date"
            className="dailyReportDateInput"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="dailyReportNavBtn"
          onClick={() => shiftDay(1)}
          aria-label="Nächster Tag"
        >
          <AppIcon icon={ChevronRight} size={18} />
        </button>
      </div>

      <p className="dailyReportSubtitle">
        {formatIsoDateLong(reportDate)} · {projectName}
      </p>

      {loading && (
        <p className="dailyReportMuted">Lade Tagesbericht…</p>
      )}

      {error && !loading && (
        <p className="dailyReportError">{error}</p>
      )}

      {!loading && !error && isEmpty && (
        <p className="dailyReportMuted">
          Für diesen Tag liegen keine Aktivitäten für das Projekt vor.
        </p>
      )}

      {!loading && !error && report && !isEmpty && (
        <>
          <div className="dailyReportKpis">
            <div className="dailyReportKpi">
              <span className="dailyReportKpiValue">
                {formatDurationSeconds(report.total_active_seconds)}
              </span>
              <span className="dailyReportKpiLabel">geschätzt aktiv</span>
            </div>
            <div className="dailyReportKpi">
              <span className="dailyReportKpiValue">
                {report.first_activity_ts != null && report.last_activity_ts != null
                  ? `${formatTimeFromTs(report.first_activity_ts)} – ${formatTimeFromTs(report.last_activity_ts)}`
                  : "—"}
              </span>
              <span className="dailyReportKpiLabel">Erfassungsfenster</span>
            </div>
            <div className="dailyReportKpi">
              <span className="dailyReportKpiValue">{report.sample_count}</span>
              <span className="dailyReportKpiLabel">Samples</span>
            </div>
          </div>

          {summaryLine && (
            <p className="dailyReportSummary">{summaryLine}</p>
          )}

          <div className="dailyReportCharts">
            <div className="dailyReportChartBlock">
              <h4 className="dailyReportChartTitle">Kategorien</h4>
              <p className="dailyReportChartHint">
                Geschätzte Verweildauer an diesem Tag.
              </p>
              <div className="dailyReportChartPane">
                <ActivityPieChart
                  data={pieSegments}
                  categoryOrder={categoryOrder}
                  emptyHint="Keine Kategoriedaten für diesen Tag."
                />
              </div>
            </div>
            <div className="dailyReportChartBlock">
              <h4 className="dailyReportChartTitle">Zeitverlauf</h4>
              <p className="dailyReportChartHint">
                Aktive Zeit pro {formatBucketLabel(TIMELINE_BUCKET_SECONDS)}-Fenster.
              </p>
              <div className="dailyReportChartPane">
                <TimeSeriesChart
                  data={timeline}
                  categoryOrder={categoryOrder}
                  bucketSeconds={TIMELINE_BUCKET_SECONDS}
                  emptyHint="Kein Zeitverlauf für diesen Tag."
                />
              </div>
            </div>
          </div>

          <ChartLegend
            entries={legendEntries}
            viewLabel="Summe an diesem Tag"
          />

          {report.top_contexts.length > 0 && (
            <div className="dailyReportTopContexts">
              <h4 className="dailyReportChartTitle">Top-Kontexte</h4>
              <ul className="dailyReportTopList">
                {report.top_contexts.map((item) => (
                  <li key={item.name} className="dailyReportTopItem">
                    <span className="dailyReportTopName">{item.name}</span>
                    <span className="dailyReportTopValue">
                      {formatDurationSeconds(item.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="dailyReportActions">
            <button
              type="button"
              onClick={() => onShowInTable(reportDate)}
            >
              Details in Liste anzeigen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
