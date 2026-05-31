import {
  Pie,
  PieChart,
  PieLabelRenderProps,
  PieSectorShapeProps,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import { formatDurationSeconds } from "../../utils/dwellByCategory.ts";
import { colorForCategory } from "../../utils/chartColors";
import { pieTooltipProps } from "./ChartTooltip";

export type PieSegment = { name: string; value: number };

const RADIAN = Math.PI / 180;

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

function makePieShape(categoryOrder: readonly string[]) {
  return function PieShape(props: PieSectorShapeProps) {
    const name = (props.payload as PieSegment | undefined)?.name ?? "";
    return <Sector {...props} fill={colorForCategory(name, categoryOrder)} />;
  };
}

type Props = {
  data: PieSegment[];
  categoryOrder: readonly string[];
  isAnimationActive?: boolean;
  emptyHint?: string;
};

export default function ActivityPieChart({
  data,
  categoryOrder,
  isAnimationActive = false,
  emptyHint = "Keine Daten für dieses Projekt.",
}: Props) {
  if (data.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontStyle: "italic", marginTop: 8 }}>
        {emptyHint}
      </p>
    );
  }

  const pieShape = makePieShape(categoryOrder);

  return (
    <div className="pieChartPlot">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            {...pieTooltipProps}
            formatter={(value) => {
              const numericValue =
                typeof value === "number" ? value : Number(value ?? 0);
              return formatDurationSeconds(numericValue);
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
            shape={pieShape}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
