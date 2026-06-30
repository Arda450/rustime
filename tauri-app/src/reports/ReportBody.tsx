import { invoke } from "@tauri-apps/api/core";
import { useMemo, useState, type ReactNode } from "react";
import type { ExportCsvResult, ReportCore } from "../types";
import { formatDurationSeconds } from "../utils/formatDuration";
import {
  buildChartLegendEntries,
  mergeCategoryOrder,
} from "../utils/chartLegend";
import ActivityPieChart from "../components/charts/PieChart";
import type { PieSegment } from "../components/charts/PieChart";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import ChartLegend from "../components/charts/ChartLegend";

export type ReportKpi = {
  value: string;
  label: string;
};

export type ReportBodyLabels = {
  pieTitle: string;
  pieHint: string;
  pieLegend: string;
  pieEmpty: string;
  timelineTitle: string;
  timelineHint: string;
  timelineLegend: string;
  timelineEmpty: string;
  topContextsTitle: string;
  topTitlesTitle: string;
  showInTableTitle: string;
  showInTableLabel: string;
  exportJson: string;
  exportCsv: string;
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
  exportArgs,
  onShowInTable,
}: Props) {
  const [exportMsg, setExportMsg] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const pieSegments: PieSegment[] = useMemo(
    () =>
      report.by_category.map((s) => ({
        name: s.name,
        value: s.value,
      })),
    [report.by_category],
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

  async function exportJson() {
    try {
      setIsExporting(true);
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
      setIsExporting(false);
    }
  }

  async function exportCsv() {
    try {
      setIsExporting(true);
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
      setIsExporting(false);
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

      <div className="periodReportCharts">
        <div className="periodReportChartBlock">
          <h4 className="periodReportChartTitle">{labels.pieTitle}</h4>
          <p className="periodReportChartHint">{labels.pieHint}</p>
          <div className="periodReportChartPane">
            <ActivityPieChart
              data={pieSegments}
              categoryOrder={categoryOrder}
              emptyHint={labels.pieEmpty}
            />
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
              emptyHint={labels.timelineEmpty}
            />
          </div>
          <ChartLegend
            entries={timelineLegendEntries}
            viewLabel={labels.timelineLegend}
          />
        </div>
      </div>

      {report.top_contexts.length > 0 && (
        <div className="periodReportTopContexts">
          <h4 className="periodReportChartTitle">{labels.topContextsTitle}</h4>
          <ul className="periodReportTopList">
            {report.top_contexts.map((item) => (
              <li key={item.name} className="periodReportTopItem">
                <span className="periodReportTopName">{item.name}</span>
                <span className="periodReportTopValue">
                  {formatDurationSeconds(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.top_window_titles.length > 0 && (
        <div className="periodReportTopContexts">
          <h4 className="periodReportChartTitle">{labels.topTitlesTitle}</h4>
          <ul className="periodReportTopList">
            {report.top_window_titles.map((item) => (
              <li key={item.name} className="periodReportTopItem">
                <span className="periodReportTopName" title={item.name}>
                  {item.name}
                </span>
                <span className="periodReportTopValue">
                  {formatDurationSeconds(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="periodReportActions">
        <button
          type="button"
          title={labels.showInTableTitle}
          onClick={onShowInTable}
        >
          {labels.showInTableLabel}
        </button>
        <button type="button" onClick={exportJson} disabled={isExporting}>
          {isExporting ? "Export…" : labels.exportJson}
        </button>
        <button type="button" onClick={exportCsv} disabled={isExporting}>
          {isExporting ? "Export…" : labels.exportCsv}
        </button>
      </div>

      {exportMsg && <p className="periodReportExportMsg">{exportMsg}</p>}
    </div>
  );
}