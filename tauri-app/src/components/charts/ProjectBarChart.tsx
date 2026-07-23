import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { memo, useCallback, useMemo } from "react";
import type { DwellSegment } from "../../types";
import { colorForCategory } from "../../utils/chartColors";
import { formatDurationSeconds } from "../../utils/formatDuration";
import { pieTooltipProps } from "./ChartTooltip";

type ChartRow = {
  name: string;
  label: string;
  value: number;
};

type Props = {
  items: DwellSegment[];
  highlightName?: string | null;
  formatLabel?: (name: string) => string;
  emptyHint?: string;
};

const ROW_HEIGHT_PX = 36;
const CHART_PAD_PX = 28;
const Y_AXIS_WIDTH = 128;

function accentFill(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  return raw || "#4A9EFF";
}

function toChartRows(
  items: DwellSegment[],
  formatLabel: (name: string) => string,
): ChartRow[] {
  return [...items]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      name: item.name,
      label: formatLabel(item.name),
      value: item.value,
    }));
}

function ProjectBarChartInner({
  items,
  highlightName = null,
  formatLabel = (name: string) => name,
  emptyHint = "Keine Projektzeit für diesen Zeitraum.",
}: Props) {
  // Memoize: Chart-Daten
  const data = useMemo(
    () => toChartRows(items, formatLabel),
    [items, formatLabel],
  );

  const categoryOrder = useMemo(() => data.map((row) => row.name), [data]);
  const chartHeight = Math.max(100, data.length * ROW_HEIGHT_PX + CHART_PAD_PX);
  const maxValue = data[0]?.value ?? 1;

  // Memoize: Tooltip-Formatter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = useCallback(
    (value: any) => formatDurationSeconds(Number(value ?? 0)),
    [],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelFormatter = useCallback((_: any, payload: any) => {
    const row = payload?.[0]?.payload as ChartRow | undefined;
    return row?.name ?? "";
  }, []);

  if (data.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="projectBarChartPlot">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 72, left: 4, bottom: 0 }}
          barCategoryGap="20%"
        >
          <XAxis type="number" domain={[0, maxValue]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={Y_AXIS_WIDTH}
            tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <Tooltip
            {...pieTooltipProps}
            cursor={{ fill: "var(--border)", opacity: 0.35 }}
            formatter={tooltipFormatter}
            labelFormatter={labelFormatter}
          />
          <Bar
            dataKey="value"
            name="Zeit"
            radius={[0, 6, 6, 0]}
            isAnimationActive={false}
            maxBarSize={22}
          >
            {data.map((row) => {
              const isHighlighted =
                highlightName != null && row.name === highlightName;
              const fill = isHighlighted
                ? accentFill()
                : colorForCategory(row.name, categoryOrder);
              return <Cell key={row.name} fill={fill} />;
            })}
            <LabelList
              dataKey="value"
              position="right"
              fill="var(--muted)"
              fontSize={11}
              formatter={tooltipFormatter}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const ProjectBarChart = memo(ProjectBarChartInner);
export default ProjectBarChart;
