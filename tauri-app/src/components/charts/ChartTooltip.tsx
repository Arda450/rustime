import { formatDurationSeconds } from "../../utils/formatDuration";
import { chartTooltipStyle } from "../../utils/chartColors";

export type TimeSeriesTooltipBodyProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string;
    color?: string;
  }>;
  label?: string | number;
};

export function TimeSeriesTooltipBody({
  active,
  payload,
  label,
}: TimeSeriesTooltipBodyProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const rows = payload.filter((entry) => Number(entry.value ?? 0) > 0);
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="chartTooltip" style={chartTooltipStyle.contentStyle}>
      <p className="chartTooltipTitle">Zeitfenster: {label}</p>
      <ul className="chartTooltipList">
        {rows.map((entry) => (
          <li key={String(entry.name)} className="chartTooltipRow">
            <span
              className="chartTooltipDot"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="chartTooltipName">{entry.name}</span>
            <span className="chartTooltipValue">
              {formatDurationSeconds(Number(entry.value ?? 0) * 60)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const timeSeriesTooltipWrapperStyle = chartTooltipStyle.wrapperStyle;

export const pieTooltipProps = {
  contentStyle: chartTooltipStyle.contentStyle,
  wrapperStyle: chartTooltipStyle.wrapperStyle,
  itemStyle: chartTooltipStyle.itemStyle,
} as const;
