import { invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DailyReport } from "../types";
import {
  addDaysIso,
  clampIsoDateToToday,
  dateInputToFromTs,
  dateInputToToTs,
  formatIsoDate,
  formatIsoDateLong,
  formatTimeFromTs,
  isIsoDateBeforeToday,
  todayIsoDate,
} from "../utils/dateRange";
import { formatDurationSeconds } from "../utils/formatDuration";
import { useReportLoad } from "../hooks/useReportLoad";
import {
  DAILY_TIMELINE_BUCKET_SECONDS,
  REPORT_DWELL_OPTS,
  REPORT_ESTIMATION_HINT,
} from "../reports/reportConfig";
import { ReportBody } from "../reports/ReportBody";
import { ReportBarList } from "../reports/ReportBarList";
import { formatBucketLabel } from "../utils/timeSeriesBuckets";
import { AppIcon } from "./Icon";

type Props = {
  projectId: number;
  projectName: string;
  dwellRevision: number;
  onShowInTable: (from: string, to: string) => void;
};

function buildNarrativeSummary(report: DailyReport, isoDate: string): string {
  const top =
    report.by_category.find((s) => s.name !== "Sonstige") ??
    report.by_category[0];
  const active = formatDurationSeconds(report.total_active_seconds);
  const dateLabel = formatIsoDate(isoDate);

  if (!top || report.total_active_seconds === 0) {
    return `Am ${dateLabel} wurden keine aktive Zeit für dieses Projekt geschätzt.`;
  }

  const pct =
    report.total_active_seconds > 0
      ? Math.round((top.value / report.total_active_seconds) * 100)
      : 0;

  return `Am ${dateLabel} hast du ca. ${active} aktiv gearbeitet — Schwerpunkt: ${top.name} (${pct} %).`;
}

export function DailyReportView({
  projectId,
  projectName,
  dwellRevision,
  onShowInTable,
}: Props) {
  const today = todayIsoDate();
  const [reportDate, setReportDate] = useState(today);

  const queryKey = `${projectId}|${reportDate}|${dwellRevision}`;

  const load = useCallback(async () => {
    const fromTs = dateInputToFromTs(reportDate);
    const toTs = dateInputToToTs(reportDate);
    return invoke<DailyReport>("get_daily_report", {
      projectId,
      date: reportDate,
      fromTs,
      toTs,
      ...REPORT_DWELL_OPTS,
    });
  }, [projectId, reportDate]);

  const {
    data: report,
    loading,
    isRefreshing,
    error,
  } = useReportLoad({
    queryKey,
    load,
    deps: [projectId, reportDate, dwellRevision],
    loadErrorMessage: "Tagesbericht konnte nicht geladen werden.",
  });

  const isToday = reportDate === today;
  const canGoForward = isIsoDateBeforeToday(reportDate);
  const isEmpty = report != null && report.first_activity_ts == null;

  const narrativeSummary = useMemo(
    () => (report ? buildNarrativeSummary(report, reportDate) : null),
    [report, reportDate],
  );

  const exportArgs = useMemo(
    () => ({
      projectId,
      fromTs: dateInputToFromTs(reportDate),
      toTs: dateInputToToTs(reportDate),
      contextQuery: null,
    }),
    [projectId, reportDate],
  );

  const kpis = useMemo(() => {
    if (!report) return [];
    return [
      {
        value: formatDurationSeconds(report.total_active_seconds),
        label: "geschätzt aktiv",
      },
      {
        value:
          report.first_activity_ts != null && report.last_activity_ts != null
            ? `${formatTimeFromTs(report.first_activity_ts)} – ${formatTimeFromTs(report.last_activity_ts)}`
            : "—",
        label: "Erfassungsfenster",
      },
      {
        value: String(report.context_count),
        label: "Kontexte",
      },
    ];
  }, [report]);

  return (
    <div className="periodReport">
      <div className="periodReportNav">
        <button
          type="button"
          className="periodReportNavBtn"
          onClick={() =>
            setReportDate((d) => clampIsoDateToToday(addDaysIso(d, -1)))
          }
          aria-label="Vorheriger Tag"
        >
          <AppIcon icon={ChevronLeft} size={18} />
        </button>
        <label className="periodReportDateField">
          <span className="periodReportDateLabel">Bericht für</span>
          <input
            type="date"
            className="appDateInput"
            value={reportDate}
            max={today}
            onChange={(e) => setReportDate(clampIsoDateToToday(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="periodReportNavBtn"
          onClick={() =>
            setReportDate((d) => clampIsoDateToToday(addDaysIso(d, 1)))
          }
          disabled={!canGoForward}
          aria-label="Nächster Tag"
        >
          <AppIcon icon={ChevronRight} size={18} />
        </button>
        <button
          type="button"
          className="periodReportTodayBtn"
          onClick={() => setReportDate(today)}
          disabled={isToday}
        >
          Heute
        </button>
      </div>

      <p className="periodReportSubtitle">
        {formatIsoDateLong(reportDate)} · {projectName}
      </p>

      <p className="periodReportEstimationHint">{REPORT_ESTIMATION_HINT}</p>

      {loading && !report && (
        <p className="periodReportMuted">Lade Tagesbericht…</p>
      )}

      {error && !loading && <p className="periodReportError">{error}</p>}

      {!loading && !error && report && isEmpty && (
        <p className="periodReportMuted">
          Für diesen Tag liegen keine Aktivitäten für das Projekt «{projectName}
          » vor.
        </p>
      )}

      {report && !isEmpty && (
        <ReportBody
          report={report}
          isRefreshing={isRefreshing}
          narrativeSummary={narrativeSummary}
          timelineBucketSeconds={DAILY_TIMELINE_BUCKET_SECONDS}
          trimLeadingEmptyBuckets={false}
          kpis={kpis}
          reportSubtitle={`${formatIsoDateLong(reportDate)} · ${projectName}`}
          labels={{
            pieTitle: "Kontexte",
            pieHint: "Geschätzte Verweildauer pro Kontext an diesem Tag.",
            pieLegend: "Anteil an diesem Tag",
            pieEmpty: "Keine Kategoriedaten für diesen Tag.",
            activityTypePieTitle: "Tätigkeitsklassen",
            activityTypePieHint:
              "Aufteilung nach Tätigkeit (Entwicklung, Kommunikation, Recherche, Organisation, Sonstiges).",
            activityTypePieLegend: "Anteil an diesem Tag",
            activityTypePieEmpty: "Keine Tätigkeitsdaten für diesen Tag.",
            timelineTitle: "Zeitverlauf (00:00–24:00)",
            timelineHint: `Aktive Zeit pro ${formatBucketLabel(DAILY_TIMELINE_BUCKET_SECONDS)}-Fenster.`,
            timelineLegend: "Summe an diesem Tag",
            timelineEmpty: "Kein Zeitverlauf für diesen Tag.",
            showInTableTitle:
              "Filtert die Aktivitätstabelle links auf den gewählten Tag und zeigt alle einzelnen Fenster-Einträge.",
            showInTableLabel: "Details in Liste",
            exportJson: "Tag als JSON exportieren",
            exportCsv: "Tag als CSV exportieren",
            exportPdf: "Tag als PDF exportieren",
          }}
          extraSections={
            report.by_project_day.length > 0 ? (
              <div className="periodReportProjects">
                <h4 className="periodReportChartTitle">
                  Zeit pro Projekt (gesamter Tag)
                </h4>
                <p className="periodReportChartHint">
                  Alle Projekte an diesem Tag — unabhängig vom aktiven Projekt.
                </p>
                <ReportBarList
                  items={report.by_project_day}
                  highlightName={projectName}
                />
              </div>
            ) : null
          }
          exportArgs={exportArgs}
          onShowInTable={() => onShowInTable(reportDate, reportDate)}
        />
      )}
    </div>
  );
}
