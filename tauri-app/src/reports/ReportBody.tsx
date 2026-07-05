import { invoke } from "@tauri-apps/api/core";
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { ExportCsvResult, ReportCore } from "../types";
import {
  buildChartLegendEntries,
  mergeCategoryOrder,
} from "../utils/chartLegend";
import ActivityPieChart from "../components/charts/PieChart";
import type { PieSegment } from "../components/charts/PieChart";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import ChartLegend from "../components/charts/ChartLegend";
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
  showInTableTitle: string;
  showInTableLabel: string;
  exportJson: string;
  exportCsv: string;
  exportPdf: string;
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
  onShowInTable: () => void;
};

export function ReportBody({
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
  onShowInTable,
}: Props) {
  const [exportMsg, setExportMsg] = useState("");
  const [activeExport, setActiveExport] = useState<
    "json" | "csv" | "pdf" | null
  >(null);

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
      buildChartLegendEntries(activityTypeOrder, "pie", activityTypePieSegments, []),
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

  async function exportPdf() {
    try {
      setActiveExport("pdf");
      setExportMsg("");

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

      const path = await invoke<string>("export_report_pdf_to_downloads", {
        pdfBytes: Array.from(pdfBytes),
      });
      setExportMsg(`PDF gespeichert: ${path}`);
    } catch (e) {
      console.error("report export pdf failed", e);
      setExportMsg("PDF-Export fehlgeschlagen.");
    } finally {
      setActiveExport(null);
    }
  }

  async function exportJson() {
    try {
      setActiveExport("json");
      setExportMsg("");
      const path = await invoke<string>(
        "export_activities_json_to_downloads",
        exportArgs,
      );
      setExportMsg(`JSON gespeichert: ${path}`);
    } catch (e) {
      console.error("report export json failed", e);
      setExportMsg("JSON-Export fehlgeschlagen.");
    } finally {
      setActiveExport(null);
    }
  }

  async function exportCsv() {
    try {
      setActiveExport("csv");
      setExportMsg("");
      const result = await invoke<ExportCsvResult>(
        "export_activities_csv_to_downloads",
        exportArgs,
      );
      setExportMsg(
        `CSV gespeichert — Samples: ${result.samples_path} | Aggregation: ${result.aggregated_path}`,
      );
    } catch (e) {
      console.error("report export csv failed", e);
      setExportMsg("CSV-Export fehlgeschlagen.");
    } finally {
      setActiveExport(null);
    }
  }

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

      {activityTypePieSegments.length > 0 && (
        <div className="periodReportActivityTypeChart">
          <h4 className="periodReportChartTitle">{labels.activityTypePieTitle}</h4>
          <p className="periodReportChartHint">{labels.activityTypePieHint}</p>
          <div className="periodReportChartPane periodReportChartPaneActivityType">
            <div ref={activityTypeChartRef} className="periodReportPdfCapture">
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

      <div className="periodReportCharts">
        <div className="periodReportChartBlock">
          <h4 className="periodReportChartTitle">{labels.pieTitle}</h4>
          <p className="periodReportChartHint">{labels.pieHint}</p>
          <div className="periodReportChartPane">
            <div ref={pieChartRef} className="periodReportPdfCapture">
              <ActivityPieChart
              data={pieSegments}
              categoryOrder={categoryOrder}
              emptyHint={labels.pieEmpty}
            />
            </div>
          </div>
          <ChartLegend entries={pieLegendEntries} viewLabel={labels.pieLegend} />
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
      </div>

      <div className="periodReportActions">
        <button
          type="button"
          title={labels.showInTableTitle}
          onClick={onShowInTable}
        >
          {labels.showInTableLabel}
        </button>
        <button
          type="button"
          onClick={exportJson}
          disabled={activeExport !== null}
        >
          {activeExport === "json" ? "Export…" : labels.exportJson}
        </button>
        <button type="button" onClick={exportCsv} disabled={activeExport !== null}>
          {activeExport === "csv" ? "Export…" : labels.exportCsv}
        </button>
        <button type="button" onClick={exportPdf} disabled={activeExport !== null}>
          {activeExport === "pdf" ? "Export…" : labels.exportPdf}
        </button>
      </div>

      {exportMsg && <p className="periodReportExportMsg">{exportMsg}</p>}
    </div>
  );
}