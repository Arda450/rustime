import { invoke } from "@tauri-apps/api/core";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ExportCsvResult, ReportCore } from "../types";
import {
  buildChartLegendEntries,
  mergeCategoryOrder,
} from "../utils/chartLegend";
import ActivityPieChart from "../components/charts/PieChart";
import type { PieSegment } from "../components/charts/PieChart";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import ChartLegend from "../components/charts/ChartLegend";
import { useToast } from "../components/toast/ToastContext";
import { fileNameFromPath } from "../utils/fileNameFromPath";
import {
  aggregatedCsvPathBeside,
  defaultExportFileName,
  pickExportSavePath,
} from "../utils/exportSaveDialog";
import { REPORT_ESTIMATION_HINT } from "./reportConfig";
import { buildReportPdf } from "./exportReportPdf";

export type ReportKpi = {
  value: string;
  label: string;
};

export type ReportBodyLabels = {
  pieTitle: string;
  pieHint: string;
  pieLegend: string;
  pieEmpty: string;
  activityTypePieTitle: string;
  activityTypePieHint: string;
  activityTypePieLegend: string;
  activityTypePieEmpty: string;
  timelineTitle: string;
  timelineHint: string;
  timelineLegend: string;
  timelineEmpty: string;
  exportJson: string;
  exportCsv: string;
  exportPdf: string;
};

export type ReportExportApi = {
  exportJson: () => void;
  exportCsv: () => void;
  exportPdf: () => void;
  busy: boolean;
  labels: Pick<ReportBodyLabels, "exportJson" | "exportCsv" | "exportPdf">;
};

type Props = {
  report: ReportCore;
  isRefreshing: boolean;
  narrativeSummary: string | null;
  timelineBucketSeconds: number;
  trimLeadingEmptyBuckets?: boolean;
  kpis: ReportKpi[];
  labels: ReportBodyLabels;
  extraSections?: ReactNode;
  reportSubtitle: string;
  exportArgs: {
    projectId: number;
    fromTs: number;
    toTs: number;
    contextQuery: null;
  };
  onExportApiChange?: (api: ReportExportApi | null) => void;
};

function ReportBodyInner({
  report,
  isRefreshing,
  narrativeSummary,
  timelineBucketSeconds,
  trimLeadingEmptyBuckets = false,
  kpis,
  labels,
  extraSections,
  reportSubtitle,
  exportArgs,
  onExportApiChange,
}: Props) {
  const toast = useToast();
  const [activeExport, setActiveExport] = useState<
    "json" | "csv" | "pdf" | null
  >(null);
  // Deferred Rendering: Charts erst nach dem ersten Frame rendern,
  // damit die UI sofort erscheint und nicht blockiert.
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    // requestAnimationFrame sorgt dafür, dass der erste Frame gezeichnet wird,
    // bevor die schweren Charts gerendert werden.
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const activityTypeChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const timelinePlotRef = useRef<HTMLDivElement>(null);

  const pieSegments: PieSegment[] = useMemo(
    () =>
      report.by_category.map((s) => ({
        name: s.name,
        value: s.value,
      })),
    [report.by_category],
  );

  const activityTypePieSegments: PieSegment[] = useMemo(
    () =>
      report.by_activity_type.map((s) => ({
        name: s.name,
        value: s.value,
      })),
    [report.by_activity_type],
  );

  const activityTypeOrder = useMemo(
    () => activityTypePieSegments.map((s) => s.name),
    [activityTypePieSegments],
  );

  const activityTypeLegendEntries = useMemo(
    () =>
      buildChartLegendEntries(
        activityTypeOrder,
        "pie",
        activityTypePieSegments,
        [],
      ),
    [activityTypeOrder, activityTypePieSegments],
  );

  const timeline = report.timeline;

  const categoryOrder = useMemo(
    () =>
      mergeCategoryOrder(
        pieSegments.map((s) => s.name),
        pieSegments,
        timeline,
      ),
    [pieSegments, timeline],
  );

  const pieLegendEntries = useMemo(
    () => buildChartLegendEntries(categoryOrder, "pie", pieSegments, timeline),
    [categoryOrder, pieSegments, timeline],
  );

  const timelineLegendEntries = useMemo(
    () =>
      buildChartLegendEntries(
        categoryOrder,
        "timeseries",
        pieSegments,
        timeline,
      ),
    [categoryOrder, pieSegments, timeline],
  );

  const exportPdf = useCallback(async () => {
    try {
      const targetPath = await pickExportSavePath({
        title: "PDF speichern",
        defaultFileName: defaultExportFileName("rustime-bericht", "pdf"),
        extension: "pdf",
        filterName: "PDF",
      });
      if (!targetPath) return;

      setActiveExport("pdf");

      const sections = [
        ...(activityTypePieSegments.length > 0
          ? [
              {
                title: labels.activityTypePieTitle,
                hint: labels.activityTypePieHint,
                captureEl: activityTypeChartRef.current,
                legendEntries: activityTypeLegendEntries,
                maxImageHeightMm: 80,
              },
            ]
          : []),
        {
          title: labels.pieTitle,
          hint: labels.pieHint,
          captureEl: pieChartRef.current,
          legendEntries: pieLegendEntries,
          maxImageHeightMm: 80,
        },
        {
          title: labels.timelineTitle,
          hint: labels.timelineHint,
          captureEl: timelinePlotRef.current,
          legendEntries: timelineLegendEntries,
          maxImageHeightMm: 105,
        },
      ];

      const pdfBytes = await buildReportPdf({
        subtitle: reportSubtitle,
        narrative: narrativeSummary,
        kpis,
        estimationHint: REPORT_ESTIMATION_HINT,
        sections,
      });

      const path = await invoke<string>("export_report_pdf_to_path", {
        pdfBytes: Array.from(pdfBytes),
        targetPath,
      });
      toast.success("PDF exportiert", {
        detail: fileNameFromPath(path),
      });
    } catch (e) {
      console.error("report export pdf failed", e);
      toast.error("PDF-Export fehlgeschlagen.");
    } finally {
      setActiveExport(null);
    }
  }, [
    activityTypeLegendEntries,
    activityTypePieSegments.length,
    kpis,
    labels.activityTypePieHint,
    labels.activityTypePieTitle,
    labels.pieHint,
    labels.pieTitle,
    labels.timelineHint,
    labels.timelineTitle,
    narrativeSummary,
    pieLegendEntries,
    reportSubtitle,
    timelineLegendEntries,
    toast,
  ]);

  const exportJson = useCallback(async () => {
    try {
      const targetPath = await pickExportSavePath({
        title: "JSON speichern",
        defaultFileName: defaultExportFileName("rustime-export", "json"),
        extension: "json",
        filterName: "JSON",
      });
      if (!targetPath) return;

      setActiveExport("json");
      const path = await invoke<string>("export_activities_json_to_path", {
        ...exportArgs,
        targetPath,
      });
      toast.success("JSON exportiert", {
        detail: fileNameFromPath(path),
      });
    } catch (e) {
      console.error("report export json failed", e);
      toast.error("JSON-Export fehlgeschlagen.");
    } finally {
      setActiveExport(null);
    }
  }, [exportArgs, toast]);

  const exportCsv = useCallback(async () => {
    try {
      const samplesPath = await pickExportSavePath({
        title: "CSV Zeiteinträge speichern",
        defaultFileName: defaultExportFileName("rustime-samples", "csv"),
        extension: "csv",
        filterName: "CSV",
      });
      if (!samplesPath) return;

      setActiveExport("csv");
      const aggregatedPath = aggregatedCsvPathBeside(samplesPath);
      const result = await invoke<ExportCsvResult>(
        "export_activities_csv_to_paths",
        {
          ...exportArgs,
          samplesPath,
          aggregatedPath,
        },
      );
      toast.success("CSV exportiert", {
        detail: `${fileNameFromPath(result.samples_path)} · ${fileNameFromPath(result.aggregated_path)}`,
      });
    } catch (e) {
      console.error("report export csv failed", e);
      toast.error("CSV-Export fehlgeschlagen.");
    } finally {
      setActiveExport(null);
    }
  }, [exportArgs, toast]);

  useEffect(() => {
    if (!onExportApiChange) return;
    onExportApiChange({
      exportJson: () => void exportJson(),
      exportCsv: () => void exportCsv(),
      exportPdf: () => void exportPdf(),
      busy: activeExport !== null,
      labels: {
        exportJson: labels.exportJson,
        exportCsv: labels.exportCsv,
        exportPdf: labels.exportPdf,
      },
    });
  }, [
    activeExport,
    exportCsv,
    exportJson,
    exportPdf,
    labels.exportCsv,
    labels.exportJson,
    labels.exportPdf,
    onExportApiChange,
  ]);

  useEffect(() => {
    return () => onExportApiChange?.(null);
  }, [onExportApiChange]);

  return (
    <div
      className={[
        "periodReportContent",
        isRefreshing ? "periodReportContentRefreshing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {narrativeSummary && (
        <p className="periodReportNarrative">{narrativeSummary}</p>
      )}

      <div className="periodReportKpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="periodReportKpi">
            <span className="periodReportKpiValue">{kpi.value}</span>
            <span className="periodReportKpiLabel">{kpi.label}</span>
          </div>
        ))}
      </div>

      {extraSections}

      {/* Charts werden erst nach dem ersten Frame gerendert (deferred) */}
      {!chartsReady ? (
        <p className="periodReportMuted">Lade Diagramme…</p>
      ) : (
        <>
          {/* Beide Pie-Charts nebeneinander (weniger Whitespace) */}
          <div className="periodReportPieRow">
            {activityTypePieSegments.length > 0 && (
              <div className="periodReportChartBlock periodReportPieBlock">
                <h4 className="periodReportChartTitle">
                  {labels.activityTypePieTitle}
                </h4>
                <p className="periodReportChartHint">
                  {labels.activityTypePieHint}
                </p>
                <div className="periodReportChartPane periodReportChartPanePie">
                  <div
                    ref={activityTypeChartRef}
                    className="periodReportPdfCapture"
                  >
                    <ActivityPieChart
                      data={activityTypePieSegments}
                      categoryOrder={activityTypeOrder}
                      emptyHint={labels.activityTypePieEmpty}
                    />
                  </div>
                </div>
                <ChartLegend
                  entries={activityTypeLegendEntries}
                  viewLabel={labels.activityTypePieLegend}
                />
              </div>
            )}

            <div className="periodReportChartBlock periodReportPieBlock">
              <h4 className="periodReportChartTitle">{labels.pieTitle}</h4>
              <p className="periodReportChartHint">{labels.pieHint}</p>
              <div className="periodReportChartPane periodReportChartPanePie">
                <div ref={pieChartRef} className="periodReportPdfCapture">
                  <ActivityPieChart
                    data={pieSegments}
                    categoryOrder={categoryOrder}
                    emptyHint={labels.pieEmpty}
                  />
                </div>
              </div>
              <ChartLegend
                entries={pieLegendEntries}
                viewLabel={labels.pieLegend}
              />
            </div>
          </div>

          <div className="periodReportChartBlock">
            <h4 className="periodReportChartTitle">{labels.timelineTitle}</h4>
            <p className="periodReportChartHint">{labels.timelineHint}</p>
            <div className="periodReportChartPane periodReportChartPaneTimeline">
              <TimeSeriesChart
                data={timeline}
                categoryOrder={categoryOrder}
                bucketSeconds={timelineBucketSeconds}
                trimLeadingEmptyBuckets={trimLeadingEmptyBuckets}
                plotCaptureRef={timelinePlotRef}
                emptyHint={labels.timelineEmpty}
              />
            </div>
            <ChartLegend
              entries={timelineLegendEntries}
              viewLabel={labels.timelineLegend}
            />
          </div>
        </>
      )}

    </div>
  );
}

// Memoized Export: Verhindert unnötige Re-Renders bei gleichen Props
export const ReportBody = memo(ReportBodyInner);
