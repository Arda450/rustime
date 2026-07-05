import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRef, type RefObject } from "react";
import type { CategoryTimeSeriesPoint } from "../../types";
import { colorForCategory } from "../../utils/chartColors";
import {
  formatBucketLabel,
  formatTimeSeriesAxisLabel,
} from "../../utils/timeSeriesBuckets";
import {
  type TimeSeriesTooltipBodyProps,
} from "./ChartTooltip";
import { TimeSeriesTooltipPortal } from "./TimeSeriesTooltipPortal";

type Props = {
  data: CategoryTimeSeriesPoint[];
  categoryOrder?: readonly string[];
  bucketSeconds?: number;
  emptyHint?: string;
  /** Wenn false: leere Buckets am Tagesanfang behalten (Tagesbericht 00–24 Uhr). */
  trimLeadingEmptyBuckets?: boolean;
  /** Optional: Referenz auf den Plot-Container (z. B. für PDF-Export). */
  plotCaptureRef?: RefObject<HTMLDivElement | null>;
};

type ChartRow = {
  ts: number;
  label: string;
  [category: string]: number | string;
};

/** Mindestbreite pro Bucket für horizontalen Scroll (Detailansicht). */
const PX_PER_BUCKET = 32;
const CHART_HEIGHT = 420;

function secondsToMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 100) / 100;
}

export function resolveCategoryNames(
  data: CategoryTimeSeriesPoint[],
  preferredOrder: readonly string[] = [],
): string[] {
  const extra = new Set<string>();
  for (const point of data) {
    for (const cat of point.categories) {
      if (!preferredOrder.includes(cat.name)) {
        extra.add(cat.name);
      }
    }
  }
  return [...preferredOrder, ...[...extra].sort()];
}

export function trimLeadingEmptyBuckets(
  data: CategoryTimeSeriesPoint[],
): CategoryTimeSeriesPoint[] {
  const firstWithActivity = data.findIndex((point) =>
    point.categories.some((c) => c.value > 0),
  );
  if (firstWithActivity <= 0) {
    return data;
  }
  return data.slice(firstWithActivity);
}

function toChartData(
  data: CategoryTimeSeriesPoint[],
  categoryNames: readonly string[],
  bucketSeconds: number,
): ChartRow[] {
  return data.map((point) => {
    const byName = new Map(
      point.categories.map((c) => [c.name, c.value] as const),
    );
    const row: ChartRow = {
      ts: point.ts,
      label: formatTimeSeriesAxisLabel(point.ts, bucketSeconds),
    };
    for (const name of categoryNames) {
      row[name] = secondsToMinutes(byName.get(name) ?? 0);
    }
    return row;
  });
}

function hasAnyActivity(
  data: CategoryTimeSeriesPoint[],
  categoryNames: readonly string[],
): boolean {
  for (const point of data) {
    for (const cat of point.categories) {
      if (categoryNames.includes(cat.name) && cat.value > 0) {
        return true;
      }
    }
  }
  return false;
}

export default function TimeSeriesChart({
  data,
  categoryOrder = [],
  bucketSeconds = 120,
  emptyHint = "Keine Zeitverlaufsdaten für den gewählten Zeitraum.",
  trimLeadingEmptyBuckets: shouldTrimLeading = true,
  plotCaptureRef,
}: Props) {
  const plotInnerRef = useRef<HTMLDivElement>(null);

  const assignPlotRef = (el: HTMLDivElement | null) => {
    plotInnerRef.current = el;
    if (plotCaptureRef) {
      plotCaptureRef.current = el;
    }
  };
  const trimmed = shouldTrimLeading ? trimLeadingEmptyBuckets(data) : data;
  const categoryNames = resolveCategoryNames(trimmed, categoryOrder);

  if (trimmed.length === 0 || categoryNames.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>
        {emptyHint}
      </p>
    );
  }

  if (!hasAnyActivity(trimmed, categoryNames)) {
    return (
      <p style={{ color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>
        {emptyHint}
      </p>
    );
  }

  const chartData = toChartData(trimmed, categoryNames, bucketSeconds);
  const showDots = chartData.length <= 24;
  const bucketLabel = formatBucketLabel(bucketSeconds);
  const chartWidth = Math.max(chartData.length * PX_PER_BUCKET, 480);
  const denseAxis = chartData.length > 40;

  return (
    <div className="timeSeriesChartWrap">
      <p className="timeSeriesChartCaption">
        Eine Linie pro Kategorie: Minuten pro {bucketLabel}-Fenster (nicht
        summiert; bei Wechseln können mehrere Linien im selben Fenster sichtbar
        sein). Horizontal scrollen für mehr Detail.
      </p>
      <div className="timeSeriesChartPlot timeSeriesChartPlotScroll">
        <div
          ref={assignPlotRef}
          className="timeSeriesChartPlotInner"
          style={{ width: chartWidth, height: CHART_HEIGHT }}
        >
          <LineChart
            width={chartWidth}
            height={CHART_HEIGHT}
            data={chartData}
            margin={{ top: 8, right: 12, left: 4, bottom: denseAxis ? 20 : 4 }}
          >
            <Tooltip
              shared
              allowEscapeViewBox={{ x: true, y: true }}
              reverseDirection={{ x: true, y: true }}
              content={(props) => (
                <TimeSeriesTooltipPortal
                  active={props.active}
                  payload={
                    props.payload as TimeSeriesTooltipBodyProps["payload"]
                  }
                  label={props.label}
                  coordinate={props.coordinate}
                  chartRootRef={plotInnerRef}
                  bucketSeconds={bucketSeconds}
                />
              )}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            />
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              minTickGap={4}
              interval={denseAxis ? 0 : "preserveStartEnd"}
              angle={denseAxis ? -35 : 0}
              textAnchor={denseAxis ? "end" : "middle"}
              height={denseAxis ? 48 : 30}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              width={36}
              tickFormatter={(v) =>
                typeof v === "number" ? v.toFixed(1) : String(v)
              }
              label={{
                value: "Min / Fenster",
                angle: -90,
                position: "insideLeft",
                fill: "var(--muted)",
                fontSize: 11,
              }}
            />
            {categoryNames.map((name) => (
              <Line
                key={name}
                type="stepAfter"
                dataKey={name}
                name={name}
                stroke={colorForCategory(name, categoryNames)}
                strokeWidth={2}
                dot={
                  showDots
                    ? { r: 3, strokeWidth: 1, fill: "var(--surface-strong)" }
                    : false
                }
                activeDot={{ r: 5, strokeWidth: 1 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </div>
      </div>
    </div>
  );
}
