import { invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WeeklyReport } from "../types";
import {
  addWeeks,
  clampIsoDateToToday,
  clampWeekEndToToday,
  dateInputToFromTs,
  dateInputToToTs,
  formatIsoDateLong,
  formatWeekLabel,
  formatWeekRange,
  isCurrentWeek,
  todayIsoDate,
  weekEndIso,
  weekStartIso,
} from "../utils/dateRange";
import { formatDurationSeconds } from "../utils/formatDuration";
import { useReportLoad } from "../hooks/useReportLoad";
import {
  REPORT_DWELL_OPTS,
  REPORT_ESTIMATION_HINT,
  WEEKLY_TIMELINE_BUCKET_SECONDS,
} from "../reports/reportConfig";
import { ReportBody } from "../reports/ReportBody";
import { ReportBarList } from "../reports/ReportBarList";
import { AppIcon } from "./Icon";

type Props = {
  projectId: number;
  projectName: string;
  dwellRevision: number;
  onShowInTable: (from: string, to: string) => void;
};

function buildWeeklyNarrative(
  report: WeeklyReport,
  weekStart: string,
  weekEnd: string,
): string {
  const rangeLabel = formatWeekRange(weekStart, weekEnd);
  const active = formatDurationSeconds(report.total_active_seconds);

  if (report.total_active_seconds === 0) {
    return `In der Woche ${rangeLabel} wurde keine aktive Zeit für dieses Projekt geschätzt.`;
  }

  const top =
    report.by_category.find((s) => s.name !== "Sonstige") ??
    report.by_category[0];
  const pct = top
    ? Math.round((top.value / report.total_active_seconds) * 100)
    : 0;

  const busiest = report.by_day.reduce(
    (best, day) => (day.value > best.value ? day : best),
    report.by_day[0],
  );
  const busiestLabel = busiest ? formatIsoDateLong(busiest.name) : null;

  let text = `In der Woche ${rangeLabel} hast du ca. ${active} aktiv gearbeitet`;
  if (top) {
    text += ` — Schwerpunkt: ${top.name} (${pct} %)`;
  }
  if (busiestLabel) {
    text += `. Stärkster Tag: ${busiestLabel}.`;
  } else {
    text += ".";
  }
  return text;
}

export function WeeklyReportView({
  projectId,
  projectName,
  dwellRevision,
  onShowInTable,
}: Props) {
  const today = todayIsoDate();
  const [weekAnchor, setWeekAnchor] = useState(today);

  const weekStart = weekStartIso(weekAnchor);
  const weekEnd = clampWeekEndToToday(weekEndIso(weekAnchor));
  const isThisWeek = isCurrentWeek(weekAnchor);
  const canGoForward = !isThisWeek;

  const queryKey = `${projectId}|${weekStart}|${weekEnd}|${dwellRevision}`;

  const load = useCallback(async () => {
    const fromTs = dateInputToFromTs(weekStart);
    const toTs = dateInputToToTs(weekEnd);
    return invoke<WeeklyReport>("get_weekly_report", {
      projectId,
      weekStart,
      weekEnd,
      fromTs,
      toTs,
      ...REPORT_DWELL_OPTS,
    });
  }, [projectId, weekStart, weekEnd]);

  const {
    data: report,
    loading,
    isRefreshing,
    error,
  } = useReportLoad({
    queryKey,
    load,
    deps: [projectId, weekStart, weekEnd, dwellRevision],
    loadErrorMessage: "Wochenbericht konnte nicht geladen werden.",
  });

  const isEmpty = report != null && report.first_activity_ts == null;

  const narrativeSummary = useMemo(
    () => (report ? buildWeeklyNarrative(report, weekStart, weekEnd) : null),
    [report, weekStart, weekEnd],
  );

  const exportArgs = useMemo(
    () => ({
      projectId,
      fromTs: dateInputToFromTs(weekStart),
      toTs: dateInputToToTs(weekEnd),
      contextQuery: null,
    }),
    [projectId, weekStart, weekEnd],
  );

  const kpis = useMemo(() => {
    if (!report) return [];
    const avgPerDay =
      report.active_days > 0
        ? Math.round(report.total_active_seconds / report.active_days)
        : 0;
    return [
      {
        value: formatDurationSeconds(report.total_active_seconds),
        label: "geschätzt aktiv",
      },
      {
        value: String(report.active_days),
        label: "Tage mit Aktivität",
      },
      {
        value: formatDurationSeconds(avgPerDay),
        label: "Ø pro aktivem Tag",
      },
      {
        value: String(report.context_count),
        label: "Kontexte",
      },
    ];
  }, [report]);

  const byDaySorted = useMemo(
    () => [...(report?.by_day ?? [])].sort((a, b) => b.value - a.value),
    [report?.by_day],
  );

  return (
    <div className="periodReport">
      <div className="periodReportNav">
        <button
          type="button"
          className="periodReportNavBtn"
          onClick={() => setWeekAnchor((d) => addWeeks(d, -1))}
          aria-label="Vorherige Woche"
        >
          <AppIcon icon={ChevronLeft} size={18} />
        </button>
        <label className="periodReportDateField">
          <span className="periodReportDateLabel">Woche mit</span>
          <input
            type="date"
            className="appDateInput"
            value={weekAnchor}
            max={today}
            onChange={(e) => setWeekAnchor(clampIsoDateToToday(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="periodReportNavBtn"
          onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
          disabled={!canGoForward}
          aria-label="Nächste Woche"
        >
          <AppIcon icon={ChevronRight} size={18} />
        </button>
        <button
          type="button"
          className="periodReportTodayBtn"
          onClick={() => setWeekAnchor(today)}
          disabled={isThisWeek}
        >
          Diese Woche
        </button>
      </div>

      <p className="periodReportSubtitle">
        {formatWeekLabel(weekAnchor)} · {projectName}
      </p>

      <p className="periodReportEstimationHint">{REPORT_ESTIMATION_HINT}</p>

      {loading && !report && (
        <p className="periodReportMuted">Lade Wochenbericht…</p>
      )}

      {error && !loading && <p className="periodReportError">{error}</p>}

      {!loading && !error && report && isEmpty && (
        <p className="periodReportMuted">
          Für diese Woche liegen keine Aktivitäten für das Projekt «
          {projectName}» vor.
        </p>
      )}

      {report && !isEmpty && (
        <ReportBody
          report={report}
          isRefreshing={isRefreshing}
          narrativeSummary={narrativeSummary}
          timelineBucketSeconds={WEEKLY_TIMELINE_BUCKET_SECONDS}
          trimLeadingEmptyBuckets={true}
          kpis={kpis}
          reportSubtitle={`${formatWeekLabel(weekAnchor)} · ${projectName}`}
          labels={{
            pieTitle: "Kontexte",
            pieHint: "Geschätzte Verweildauer pro Kontext in dieser Woche.",
            pieLegend: "Anteil in dieser Woche",
            pieEmpty: "Keine Kategoriedaten für diese Woche.",
            activityTypePieTitle: "Tätigkeitsklassen",
            activityTypePieHint:
              "Aufteilung nach Tätigkeit (Entwicklung, Kommunikation, Recherche, Organisation, Sonstiges).",
            activityTypePieLegend: "Anteil in dieser Woche",
            activityTypePieEmpty: "Keine Tätigkeitsdaten für diese Woche.",
            timelineTitle: "Aktivität pro Tag",
            timelineHint: "Geschätzte aktive Zeit je Kalendertag (Mo–So).",
            timelineLegend: "Summe pro Tag",
            timelineEmpty: "Kein Tagesverlauf für diese Woche.",
            showInTableTitle:
              "Filtert die Aktivitätstabelle links auf den gewählten Wochenzeitraum.",
            showInTableLabel: "Details in Liste",
            exportJson: "Woche als JSON exportieren",
            exportCsv: "Woche als CSV exportieren",
            exportPdf: "Woche als PDF exportieren",
          }}
          extraSections={
            <>
              {byDaySorted.length > 0 && (
                <div className="periodReportProjects">
                  <h4 className="periodReportChartTitle">
                    Aktivität pro Tag (dieses Projekt)
                  </h4>
                  <ReportBarList
                    items={byDaySorted}
                    formatLabel={(iso) => formatIsoDateLong(iso)}
                  />
                </div>
              )}
              {report.by_project_week.length > 0 && (
                <div className="periodReportProjects">
                  <h4 className="periodReportChartTitle">
                    Zeit pro Projekt (gesamte Woche)
                  </h4>
                  <p className="periodReportChartHint">
                    Alle Projekte in dieser Woche — unabhängig vom aktiven
                    Projekt.
                  </p>
                  <ReportBarList
                    items={report.by_project_week}
                    highlightName={projectName}
                  />
                </div>
              )}
            </>
          }
          exportArgs={exportArgs}
          onShowInTable={() => onShowInTable(weekStart, weekEnd)}
        />
      )}
    </div>
  );
}
