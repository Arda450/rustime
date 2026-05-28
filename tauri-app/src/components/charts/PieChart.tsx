import {
  Pie,
  PieChart,
  PieLabelRenderProps,
  PieSectorShapeProps,
  Sector,
  Tooltip,
} from "recharts";
import { formatDurationSeconds } from "../../utils/dwellByCategory.ts";

export type PieSegment = { name: string; value: number };

const RADIAN = Math.PI / 180;
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) => {
  if (cx == null || cy == null || innerRadius == null || outerRadius == null) {
    return null;
  }
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const ncx = Number(cx);
  const x = ncx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const ncy = Number(cy);
  const y = ncy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > ncx ? "start" : "end"}
      dominantBaseline="central"
    >
      {`${((percent ?? 1) * 100).toFixed(0)}%`}
    </text>
  );
};

const MyCustomPie = (props: PieSectorShapeProps) => {
  return (
    <Sector {...props} fill={COLORS[(props.index ?? 0) % COLORS.length]} />
  );
};

type Props = {
  data: PieSegment[];
  isAnimationActive?: boolean;
  emptyHint?: string;
};

export default function PieChartWithCustomizedLabel({
  data,
  isAnimationActive = true,
  emptyHint = "Keine Daten für dieses Projekt.",
}: Props) {
  if (data.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>
        {emptyHint}
      </p>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="pieChartWithLegend">
      <PieChart
        style={{
          width: "100%",
          maxWidth: "420px",
          maxHeight: "70vh",
          aspectRatio: 1,
        }}
        responsive
      >
        <Tooltip
          formatter={(value) => {
            const numericValue =
              typeof value === "number" ? value : Number(value ?? 0);
            return formatDurationSeconds(numericValue);
          }}
          contentStyle={{
            background: "var(--surface-strong)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />
        <Pie
          data={data}
          nameKey="name"
          dataKey="value"
          labelLine={false}
          label={renderCustomizedLabel}
          fill="#8884d8"
          isAnimationActive={isAnimationActive}
          shape={MyCustomPie}
        />
      </PieChart>

      <ul className="pieLegend">
        {data.map((entry, index) => {
          const color = COLORS[index % COLORS.length];
          const percent =
            total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <li key={entry.name} className="pieLegendItem">
              <span
                className="pieLegendDot"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="pieLegendLabel">{entry.name}</span>
              <span className="pieLegendMeta">
                {formatDurationSeconds(entry.value)} ({percent}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
