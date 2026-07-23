import { invoke } from "@tauri-apps/api/core";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DailyReport, DwellSegment, WeeklyReport } from "../types";
import {
  clampIsoDateToToday,
  dateInputToFromTs,
  dateInputToToTs,
  formatIsoDateLong,
  todayIsoDate,
} from "../utils/dateRange";
import { useReportLoad } from "../hooks/useReportLoad";
import { REPORT_DWELL_OPTS, REPORT_ESTIMATION_HINT } from "./reportConfig";
import { ReportBody } from "./ReportBody";
import { ReportBarList } from "./ReportBarList";
import ProjectBarChart from "../components/charts/ProjectBarChart";
import { AppIcon } from "../components/Icon";
import {
  PERIOD_KIND_CONFIG,
  buildDailyKpis,
  buildDailyNarrative,
  buildWeeklyKpis,
  buildWeeklyNarrative,
  createDailyNavState,
  createWeeklyNavState,
  periodEmptyMessage,
  type PeriodReportMode,
  type PeriodReportViewProps,
} from "./periodReportKinds";

/**
 * Lazy-Loading Komponente für "Zeit pro Projekt".
 * Lädt die Daten separat, damit der Hauptbericht schnell erscheint.
 */
function ByProjectSection({
  fromTs,
  toTs,
  projectName,
  title,
  hint,
}: {
  fromTs: number;
  toTs: number;
  projectName: string;
  title: string;
  hint: string;
}) {
  const [data, setData] = useState<DwellSegment[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    invoke<DwellSegment[]>("get_by_project_for_range", {
      fromTs,
      toTs,
      ...REPORT_DWELL_OPTS,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        console.error("get_by_project_for_range failed", e);
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromTs, toTs]);

  if (loading) {
    return (
      <div className="periodReportProjects">
        <h4 className="periodReportChartTitle">{title}</h4>
        <p className="periodReportMuted">Lade Projektdaten…</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="periodReportProjects">
      <h4 className="periodReportChartTitle">{title}</h4>
      <p className="periodReportChartHint">{hint}</p>
      <div className="periodReportChartPane periodReportChartPaneProjects">
        <ProjectBarChart items={data} highlightName={projectName} />
      </div>
    </div>
  );
}

function buildDailyExtraSections(
  _report: DailyReport,
  ctx: { projectName: string; fromTs: number; toTs: number },
) {
  // "Zeit pro Projekt" wird jetzt lazy geladen
  return (
    <ByProjectSection
      fromTs={ctx.fromTs}
      toTs={ctx.toTs}
      projectName={ctx.projectName}
      title="Zeit pro Projekt (gesamter Tag)"
      hint="Alle Projekte an diesem Tag."
    />
  );
}

function buildWeeklyExtraSections(
  report: WeeklyReport,
  ctx: { projectName: string; fromTs: number; toTs: number },
) {
  const byDaySorted = [...report.by_day].sort((a, b) => b.value - a.value);
  return (
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
      {/* "Zeit pro Projekt" wird jetzt lazy geladen */}
      <ByProjectSection
        fromTs={ctx.fromTs}
        toTs={ctx.toTs}
        projectName={ctx.projectName}
        title="Zeit pro Projekt (gesamte Woche)"
        hint="Alle Projekte in dieser Woche."
      />
    </>
  );
}

type PeriodReportViewInternalProps = PeriodReportViewProps & {
  mode: PeriodReportMode;
};

function PeriodReportView({
  mode,
  projectId,
  projectName,
  dwellRevision,
  onExportApiChange,
}: PeriodReportViewInternalProps) {
  const kind = PERIOD_KIND_CONFIG[mode];
  const [anchor, setAnchor] = useState(todayIsoDate());

  const navState =
    mode === "daily"
      ? createDailyNavState(anchor)
      : createWeeklyNavState(anchor);

  const queryKey = `${projectId}|${navState.queryKeySuffix}|${dwellRevision}`;

  const load = useCallback(async () => {
    if (mode === "daily") {
      const daily = createDailyNavState(anchor);
      return invoke<DailyReport>(kind.invokeCommand, {
        ...daily.invokeArgs(projectId, anchor),
        ...REPORT_DWELL_OPTS,
      });
    }
    const weekly = createWeeklyNavState(anchor);
    return invoke<WeeklyReport>(kind.invokeCommand, {
      ...weekly.invokeArgs(
        projectId,
        anchor,
        weekly.rangeStart,
        weekly.rangeEnd,
      ),
      ...REPORT_DWELL_OPTS,
    });
  }, [mode, projectId, anchor, kind.invokeCommand]);

  const {
    data: report,
    loading,
    isRefreshing,
    error,
  } = useReportLoad({
    queryKey,
    load,
    deps: [projectId, navState.queryKeySuffix, dwellRevision],
    loadErrorMessage: kind.loadErrorMessage,
  });

  const isEmpty = report != null && report.first_activity_ts == null;

  useEffect(() => {
    if (!report || isEmpty) {
      onExportApiChange?.(null);
    }
  }, [report, isEmpty, onExportApiChange]);

  const narrativeSummary = useMemo(() => {
    if (!report) return null;
    if (mode === "daily") {
      return buildDailyNarrative(report as DailyReport, navState.rangeStart);
    }
    return buildWeeklyNarrative(
      report as WeeklyReport,
      navState.rangeStart,
      navState.rangeEnd,
    );
  }, [report, mode, navState.rangeStart, navState.rangeEnd]);

  const exportArgs = useMemo(
    () => ({
      projectId,
      fromTs: dateInputToFromTs(navState.rangeStart),
      toTs: dateInputToToTs(navState.rangeEnd),
      contextQuery: null,
    }),
    [projectId, navState.rangeStart, navState.rangeEnd],
  );

  const kpis = useMemo(() => {
    if (!report) return [];
    return mode === "daily"
      ? buildDailyKpis(report as DailyReport)
      : buildWeeklyKpis(report as WeeklyReport);
  }, [report, mode]);

  const extraSections = useMemo(() => {
    if (!report || isEmpty) return null;
    const fromTs = dateInputToFromTs(navState.rangeStart);
    const toTs = dateInputToToTs(navState.rangeEnd);
    const ctx = { projectName, fromTs, toTs };
    if (mode === "daily") {
      return buildDailyExtraSections(report as DailyReport, ctx);
    }
    return buildWeeklyExtraSections(report as WeeklyReport, ctx);
  }, [
    report,
    mode,
    projectName,
    isEmpty,
    navState.rangeStart,
    navState.rangeEnd,
  ]);

  const { nav } = navState;

  return (
    <div className="periodReport">
      <div className="periodReportNav">
        <button
          type="button"
          className="periodReportNavBtn"
          onClick={() => setAnchor((d) => nav.stepPrev(d))}
          aria-label={nav.prevAria}
        >
          <AppIcon icon={ChevronLeft} size={18} />
        </button>
        <label className="periodReportDateField">
          <span className="periodReportDateLabel">{nav.dateFieldLabel}</span>
          <input
            type="date"
            className="appDateInput"
            value={nav.dateValue}
            max={nav.maxDate}
            onChange={(e) => setAnchor(clampIsoDateToToday(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="periodReportNavBtn"
          onClick={() => setAnchor((d) => nav.stepNext(d))}
          disabled={!nav.canGoForward}
          aria-label={nav.nextAria}
        >
          <AppIcon icon={ChevronRight} size={18} />
        </button>
        <button
          type="button"
          className="periodReportTodayBtn"
          onClick={() => setAnchor(nav.jumpToCurrent())}
          disabled={nav.atCurrentPeriod}
        >
          {nav.currentPeriodLabel}
        </button>
      </div>

      <p className="periodReportSubtitle">
        {navState.subtitle} · {projectName}
      </p>

      <p className="periodReportEstimationHint">{REPORT_ESTIMATION_HINT}</p>

      {loading && !report && (
        <p className="periodReportMuted">{kind.loadingMessage}</p>
      )}

      {error && !loading && <p className="periodReportError">{error}</p>}

      {!loading && !error && report && isEmpty && (
        <p className="periodReportMuted">
          {periodEmptyMessage(mode, projectName)}
        </p>
      )}

      {report && !isEmpty && (
        <ReportBody
          report={report}
          isRefreshing={isRefreshing}
          narrativeSummary={narrativeSummary}
          timelineBucketSeconds={kind.timelineBucketSeconds}
          trimLeadingEmptyBuckets={kind.trimLeadingEmptyBuckets}
          kpis={kpis}
          reportSubtitle={navState.reportSubtitle(projectName)}
          labels={kind.labels}
          extraSections={extraSections}
          exportArgs={exportArgs}
          onExportApiChange={onExportApiChange}
        />
      )}
    </div>
  );
}

export const DailyReportView = memo(function DailyReportView(
  props: PeriodReportViewProps,
) {
  return <PeriodReportView mode="daily" {...props} />;
});

export const WeeklyReportView = memo(function WeeklyReportView(
  props: PeriodReportViewProps,
) {
  return <PeriodReportView mode="weekly" {...props} />;
});
