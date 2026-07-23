import { memo } from "react";
import type { DwellSegment } from "../types";
import { formatDurationSeconds } from "../utils/formatDuration";

type Props = {
  items: DwellSegment[];
  highlightName?: string | null;
  formatLabel?: (name: string) => string;
};

function ReportBarListInner({
  items,
  highlightName = null,
  formatLabel = (name) => name,
}: Props) {
  if (items.length === 0) return null;

  const max = items[0]?.value ?? 1;

  return (
    <ul className="periodReportBarList">
      {items.map((item) => {
        const widthPct = Math.max(4, Math.round((item.value / max) * 100));
        const isHighlighted = highlightName != null && item.name === highlightName;
        const label = formatLabel(item.name);
        return (
          <li key={item.name} className="periodReportBarItem">
            <span
              className={[
                "periodReportBarLabel",
                isHighlighted ? "periodReportBarLabelCurrent" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={item.name}
            >
              {label}
            </span>
            <span className="periodReportBarTrack">
              <span
                className="periodReportBarFill"
                style={{ width: `${widthPct}%` }}
              />
            </span>
            <span className="periodReportBarValue">
              {formatDurationSeconds(item.value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const ReportBarList = memo(ReportBarListInner);
