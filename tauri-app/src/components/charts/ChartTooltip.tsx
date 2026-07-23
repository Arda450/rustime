import { formatDurationSeconds } from "../../utils/formatDuration";
import { chartTooltipStyle } from "../../utils/chartColors";
import {
  formatTimeSeriesTooltipTitle,
  SECONDS_PER_DAY,
  timeSeriesValueUnit,
} from "../../utils/timeSeriesBuckets";

export type TimeSeriesTooltipBodyProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: { ts?: number };
  }>;
  label?: string | number;
  bucketSeconds?: number;
};

export function TimeSeriesTooltipBody({
  active,
  payload,
  label,
  bucketSeconds = 120,
}: TimeSeriesTooltipBodyProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const rows = payload.filter((entry) => Number(entry.value ?? 0) > 0);
  if (rows.length === 0) {
    return null;
  }

  const rowTs = payload[0]?.payload?.ts;
  const titleText =
    rowTs != null && bucketSeconds >= SECONDS_PER_DAY
      ? `Tag: ${formatTimeSeriesTooltipTitle(rowTs, bucketSeconds)}`
      : `Zeitfenster: ${label}`;

  const unit = timeSeriesValueUnit(bucketSeconds);

  return (
    <div className="chartTooltip" style={chartTooltipStyle.contentStyle}>
      <p className="chartTooltipTitle">{titleText}</p>
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
              {formatDurationSeconds(
                unit.valueToSeconds(Number(entry.value ?? 0)),
              )}
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
  labelStyle: chartTooltipStyle.labelStyle,
} as const;
