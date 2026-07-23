import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { CategoryTimeSeriesPoint } from "../../types";
import { colorForCategory } from "../../utils/chartColors";
import {
  formatBucketLabel,
  formatTimeSeriesAxisLabel,
  timeSeriesValueUnit,
  type TimeSeriesValueUnit,
} from "../../utils/timeSeriesBuckets";
import { type TimeSeriesTooltipBodyProps } from "./ChartTooltip";
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

/**
 * Hängt einen leeren Abschluss-Bucket an (Grenze nach dem letzten Fenster).
 * Nötig, weil `stepAfter` die Stufe bis zum Folgepunkt zeichnet,sonst
 * bekommt der letzte Tag/das letzte Fenster (z. B. Sonntag) keine volle Spalte.
 */
export function appendTrailingBoundary(
  data: CategoryTimeSeriesPoint[],
  bucketSeconds: number,
): CategoryTimeSeriesPoint[] {
  if (data.length === 0) {
    return data;
  }
  const last = data[data.length - 1];
  return [...data, { ts: last.ts + bucketSeconds, categories: [] }];
}

function toChartData(
  data: CategoryTimeSeriesPoint[],
  categoryNames: readonly string[],
  bucketSeconds: number,
  unit: TimeSeriesValueUnit,
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
      row[name] = unit.secondsToValue(byName.get(name) ?? 0);
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

function TimeSeriesChartInner({
  data,
  categoryOrder = [],
  bucketSeconds = 120,
  emptyHint = "Keine Zeitverlaufsdaten für den gewählten Zeitraum.",
  trimLeadingEmptyBuckets: shouldTrimLeading = true,
  plotCaptureRef,
}: Props) {
  const plotInnerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Verfügbare Breite des (stabilen) Scroll-Containers. Wird per ResizeObserver
  // gemessen, damit der Chart die Breite füllt statt Whitespace zu lassen.
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Der Scroll-Container ändert seine Breite NICHT, wenn der innere Chart
    // wächst (overflow-x: auto), daher keine ResizeObserver-Feedbackschleife.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      // Puffer, damit ein exakt passender Chart keine Scrollbar auslöst.
      setContainerWidth(Math.max(0, Math.floor(width) - 2));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const assignPlotRef = useCallback(
    (el: HTMLDivElement | null) => {
      plotInnerRef.current = el;
      if (plotCaptureRef) {
        plotCaptureRef.current = el;
      }
    },
    [plotCaptureRef],
  );

  // Memoize: Trimmen und Kategorien extrahieren
  const trimmed = useMemo(
    () => (shouldTrimLeading ? trimLeadingEmptyBuckets(data) : data),
    [data, shouldTrimLeading],
  );

  const categoryNames = useMemo(
    () => resolveCategoryNames(trimmed, categoryOrder),
    [trimmed, categoryOrder],
  );

  // Memoize: Einheit und Chart-Daten
  const unit = useMemo(
    () => timeSeriesValueUnit(bucketSeconds),
    [bucketSeconds],
  );

  const chartData = useMemo(() => {
    if (trimmed.length === 0 || categoryNames.length === 0) {
      return [];
    }
    const chartSource = appendTrailingBoundary(trimmed, bucketSeconds);
    return toChartData(chartSource, categoryNames, bucketSeconds, unit);
  }, [trimmed, categoryNames, bucketSeconds, unit]);

  // Memoize: Layout-Werte
  const { showDots, chartWidth, denseAxis, bucketLabel } = useMemo(() => {
    // Natürliche Breite (Detailansicht): mind. PX_PER_BUCKET pro Datenpunkt.
    const naturalWidth = chartData.length * PX_PER_BUCKET;
    // Container füllen, wenn wenige Punkte (Wochenbericht) → kein Whitespace.
    // Bei vielen Punkten (Tagesbericht) bleibt die natürliche Breite → Scroll.
    const width = Math.max(naturalWidth, containerWidth || 480);
    return {
      showDots: chartData.length <= 24,
      chartWidth: width,
      denseAxis: chartData.length > 40,
      bucketLabel: formatBucketLabel(bucketSeconds),
    };
  }, [chartData.length, bucketSeconds, containerWidth]);

  // Memoize: Prüfung ob Aktivität vorhanden
  const hasActivity = useMemo(
    () => hasAnyActivity(trimmed, categoryNames),
    [trimmed, categoryNames],
  );

  // Memoize: Tooltip-Renderer (vermeidet neue Funktionsreferenz bei jedem Render)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = useCallback(
    (props: any) => (
      <TimeSeriesTooltipPortal
        active={props.active}
        payload={props.payload as TimeSeriesTooltipBodyProps["payload"]}
        label={props.label}
        coordinate={props.coordinate}
        chartRootRef={plotInnerRef}
        bucketSeconds={bucketSeconds}
      />
    ),
    [bucketSeconds],
  );

  // Early returns nach allen Hooks
  if (trimmed.length === 0 || categoryNames.length === 0 || !hasActivity) {
    return (
      <p style={{ color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="timeSeriesChartWrap">
      <p className="timeSeriesChartCaption">
        Eine Linie pro Kategorie: {unit.captionUnit} pro {bucketLabel}-Fenster
        (nicht summiert; bei Wechseln können mehrere Linien im selben Fenster
        sichtbar sein). Horizontal scrollen für mehr Detail.
      </p>
      <div
        ref={scrollRef}
        className="timeSeriesChartPlot timeSeriesChartPlotScroll"
      >
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
              content={renderTooltip}
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
                value: unit.axisLabel,
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

// Memoized Export: Verhindert unnötige Re-Renders bei gleichen Props
const TimeSeriesChart = memo(TimeSeriesChartInner);
export default TimeSeriesChart;
