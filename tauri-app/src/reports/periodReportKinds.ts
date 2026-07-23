import type { ReactNode } from "react";
import type { DailyReport, WeeklyReport } from "../types";
import {
  addDaysIso,
  addWeeks,
  clampIsoDateToToday,
  dateInputToFromTs,
  dateInputToToTs,
  formatIsoDate,
  formatIsoDateLong,
  formatTimeFromTs,
  formatWeekLabel,
  formatWeekRange,
  isCurrentWeek,
  isIsoDateBeforeToday,
  todayIsoDate,
  weekEndIso,
  weekStartIso,
} from "../utils/dateRange";
import { formatDurationSeconds } from "../utils/formatDuration";
import { formatBucketLabel } from "../utils/timeSeriesBuckets";
import {
  DAILY_TIMELINE_BUCKET_SECONDS,
  WEEKLY_TIMELINE_BUCKET_SECONDS,
} from "./reportConfig";
import type { ReportBodyLabels } from "./ReportBody";
import type { ReportKpi } from "./ReportBody";

import type { ReportExportApi } from "./ReportBody";

export type PeriodReportMode = "daily" | "weekly";

export type PeriodReportViewProps = {
  projectId: number;
  projectName: string;
  dwellRevision: number;
  onExportApiChange?: (api: ReportExportApi | null) => void;
};

type PeriodReportKindConfig = {
  mode: PeriodReportMode;
  invokeCommand: "get_daily_report" | "get_weekly_report";
  loadErrorMessage: string;
  loadingMessage: string;
  timelineBucketSeconds: number;
  trimLeadingEmptyBuckets: boolean;
  labels: ReportBodyLabels;
};

function buildLabels(
  mode: PeriodReportMode,
  timelineHint: string,
): ReportBodyLabels {
  const an = mode === "daily" ? "an diesem Tag" : "in dieser Woche";
  const periodExport = mode === "daily" ? "Tag" : "Woche";

  return {
    pieTitle: "Kontexte",
    pieHint: `Geschätzte Verweildauer pro Kontext ${an}.`,
    pieLegend: `Anteil ${an}`,
    pieEmpty: `Keine Kategoriedaten für ${mode === "daily" ? "diesen Tag" : "diese Woche"}.`,
    activityTypePieTitle: "Tätigkeitsklassen",
    activityTypePieHint:
      "Aufteilung nach Tätigkeit (Entwicklung, Kommunikation, Recherche, Organisation, Sonstiges).",
    activityTypePieLegend: `Anteil ${an}`,
    activityTypePieEmpty: `Keine Tätigkeitsdaten für ${mode === "daily" ? "diesen Tag" : "diese Woche"}.`,
    timelineTitle:
      mode === "daily" ? "Zeitverlauf (00:00–24:00)" : "Aktivität pro Tag",
    timelineHint,
    timelineLegend: mode === "daily" ? "Summe an diesem Tag" : "Summe pro Tag",
    timelineEmpty:
      mode === "daily"
        ? "Kein Zeitverlauf für diesen Tag."
        : "Kein Tagesverlauf für diese Woche.",
    exportJson: `${periodExport} als JSON exportieren`,
    exportCsv: `${periodExport} als CSV exportieren`,
    exportPdf: `${periodExport} als PDF exportieren`,
  };
}

export const PERIOD_KIND_CONFIG: Record<
  PeriodReportMode,
  PeriodReportKindConfig
> = {
  daily: {
    mode: "daily",
    invokeCommand: "get_daily_report",
    loadErrorMessage: "Tagesbericht konnte nicht geladen werden.",
    loadingMessage: "Lade Tagesbericht…",
    timelineBucketSeconds: DAILY_TIMELINE_BUCKET_SECONDS,
    trimLeadingEmptyBuckets: false,
    labels: buildLabels(
      "daily",
      `Aktive Zeit pro ${formatBucketLabel(DAILY_TIMELINE_BUCKET_SECONDS)}-Fenster.`,
    ),
  },
  weekly: {
    mode: "weekly",
    invokeCommand: "get_weekly_report",
    loadErrorMessage: "Wochenbericht konnte nicht geladen werden.",
    loadingMessage: "Lade Wochenbericht…",
    timelineBucketSeconds: WEEKLY_TIMELINE_BUCKET_SECONDS,
    // Immer alle 7 Tage (Mo–So) zeigen, auch führende/leere Tage.
    trimLeadingEmptyBuckets: false,
    labels: buildLabels(
      "weekly",
      "Geschätzte aktive Zeit je Kalendertag (Mo–So).",
    ),
  },
};

export function periodEmptyMessage(
  mode: PeriodReportMode,
  projectName: string,
): string {
  if (mode === "daily") {
    return `Für diesen Tag liegen keine Aktivitäten für das Projekt «${projectName}» vor.`;
  }
  return `Für diese Woche liegen keine Aktivitäten für das Projekt «${projectName}» vor.`;
}

function topCategoryShare(
  report: DailyReport | WeeklyReport,
): { name: string; pct: number } | null {
  const top =
    report.by_category.find((s) => s.name !== "Sonstige") ??
    report.by_category[0];
  if (!top || report.total_active_seconds === 0) {
    return null;
  }
  return {
    name: top.name,
    pct: Math.round((top.value / report.total_active_seconds) * 100),
  };
}

export function buildDailyNarrative(
  report: DailyReport,
  isoDate: string,
): string {
  const dateLabel = formatIsoDate(isoDate);
  if (report.total_active_seconds === 0) {
    return `Am ${dateLabel} wurden keine aktive Zeit für dieses Projekt geschätzt.`;
  }
  const active = formatDurationSeconds(report.total_active_seconds);
  const top = topCategoryShare(report);
  if (!top) {
    return `Am ${dateLabel} hast du ca. ${active} aktiv gearbeitet.`;
  }
  return `Am ${dateLabel} hast du ca. ${active} aktiv gearbeitet - Schwerpunkt: ${top.name} (${top.pct} %).`;
}

export function buildWeeklyNarrative(
  report: WeeklyReport,
  weekStart: string,
  weekEnd: string,
): string {
  const rangeLabel = formatWeekRange(weekStart, weekEnd);
  if (report.total_active_seconds === 0) {
    return `In der Woche ${rangeLabel} wurde keine aktive Zeit für dieses Projekt geschätzt.`;
  }
  const active = formatDurationSeconds(report.total_active_seconds);
  const top = topCategoryShare(report);
  let text = `In der Woche ${rangeLabel} hast du ca. ${active} aktiv gearbeitet`;
  if (top) {
    text += ` — Schwerpunkt: ${top.name} (${top.pct} %)`;
  }
  const busiest = report.by_day.reduce(
    (best, day) => (day.value > best.value ? day : best),
    report.by_day[0],
  );
  if (busiest) {
    text += `. Stärkster Tag: ${formatIsoDateLong(busiest.name)}.`;
  } else {
    text += ".";
  }
  return text;
}

export function buildDailyKpis(report: DailyReport): ReportKpi[] {
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
}

export function buildWeeklyKpis(report: WeeklyReport): ReportKpi[] {
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
}

/** Navigations-Helfer für Tagesbericht. */
export function createDailyNavState(anchor: string) {
  const today = todayIsoDate();
  return {
    rangeStart: anchor,
    rangeEnd: anchor,
    subtitle: `${formatIsoDateLong(anchor)}`,
    reportSubtitle: (projectName: string) =>
      `${formatIsoDateLong(anchor)} · ${projectName}`,
    queryKeySuffix: anchor,
    nav: {
      dateFieldLabel: "Bericht für",
      dateValue: anchor,
      maxDate: today,
      canGoForward: isIsoDateBeforeToday(anchor),
      atCurrentPeriod: anchor === today,
      currentPeriodLabel: "Heute",
      prevAria: "Vorheriger Tag",
      nextAria: "Nächster Tag",
      stepPrev: (d: string) => clampIsoDateToToday(addDaysIso(d, -1)),
      stepNext: (d: string) => clampIsoDateToToday(addDaysIso(d, 1)),
      jumpToCurrent: () => today,
    },
    invokeArgs: (projectId: number, date: string) => ({
      projectId,
      date,
      fromTs: dateInputToFromTs(date),
      toTs: dateInputToToTs(date),
    }),
  };
}

/** Navigations-Helfer für Wochenbericht. */
export function createWeeklyNavState(anchor: string) {
  const today = todayIsoDate();
  const weekStart = weekStartIso(anchor);
  // Ganze Woche Mo–So (nicht auf heute begrenzt), damit der Zeitverlauf alle 7 Tage zeigt.
  const weekEnd = weekEndIso(anchor);
  return {
    rangeStart: weekStart,
    rangeEnd: weekEnd,
    subtitle: formatWeekLabel(anchor),
    reportSubtitle: (projectName: string) =>
      `${formatWeekLabel(anchor)} · ${projectName}`,
    queryKeySuffix: `${weekStart}|${weekEnd}`,
    nav: {
      dateFieldLabel: "Woche mit",
      dateValue: anchor,
      maxDate: today,
      canGoForward: !isCurrentWeek(anchor),
      atCurrentPeriod: isCurrentWeek(anchor),
      currentPeriodLabel: "Diese Woche",
      prevAria: "Vorherige Woche",
      nextAria: "Nächste Woche",
      stepPrev: (d: string) => addWeeks(d, -1),
      stepNext: (d: string) => addWeeks(d, 1),
      jumpToCurrent: () => today,
    },
    invokeArgs: (
      projectId: number,
      _anchor: string,
      start: string,
      end: string,
    ) => ({
      projectId,
      weekStart: start,
      weekEnd: end,
      fromTs: dateInputToFromTs(start),
      toTs: dateInputToToTs(end),
    }),
  };
}

export type PeriodExtraSectionsContext = {
  projectName: string;
};

export type PeriodExtraSectionsBuilder = (
  report: DailyReport | WeeklyReport,
  ctx: PeriodExtraSectionsContext,
) => ReactNode;
