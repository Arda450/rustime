import type { CategoryTimeSeriesPoint } from "../types";
import type { PieSegment } from "../components/charts/PieChart";
import { colorForCategory } from "./chartColors";
import { formatDurationSeconds } from "./dwellByCategory";

export type ChartViewMode = "pie" | "timeseries";

export type ChartLegendEntry = {
  name: string;
  color: string;
  meta: string;
};

export function mergeCategoryOrder(
  preferred: readonly string[],
  pie: readonly PieSegment[],
  timeSeries: readonly CategoryTimeSeriesPoint[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  };

  for (const name of preferred) add(name);
  for (const s of pie) add(s.name);
  for (const point of timeSeries) {
    for (const c of point.categories) add(c.name);
  }

  return out;
}

export function aggregateTimeSeriesTotals(
  data: readonly CategoryTimeSeriesPoint[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const point of data) {
    for (const cat of point.categories) {
      totals.set(cat.name, (totals.get(cat.name) ?? 0) + cat.value);
    }
  }
  return totals;
}

export function buildChartLegendEntries(
  categoryOrder: readonly string[],
  view: ChartViewMode,
  pie: readonly PieSegment[],
  timeSeries: readonly CategoryTimeSeriesPoint[],
): ChartLegendEntry[] {
  const pieByName = new Map(pie.map((s) => [s.name, s.value]));
  const tsTotals = aggregateTimeSeriesTotals(timeSeries);
  const pieTotal = pie.reduce((sum, s) => sum + s.value, 0);

  return categoryOrder
    .map((name) => {
      const color = colorForCategory(name, categoryOrder);

      if (view === "pie") {
        const value = pieByName.get(name) ?? 0;
        const percent = pieTotal > 0 ? Math.round((value / pieTotal) * 100) : 0;
        return {
          name,
          color,
          meta: `${formatDurationSeconds(value)} (${percent}%)`,
          value,
        };
      }

      const value = tsTotals.get(name) ?? 0;
      return {
        name,
        color,
        meta: `${formatDurationSeconds(value)} im Zeitraum`,
        value,
      };
    })
    .filter((entry) => entry.value > 0)
    .map(({ name, color, meta }) => ({ name, color, meta }));
}
