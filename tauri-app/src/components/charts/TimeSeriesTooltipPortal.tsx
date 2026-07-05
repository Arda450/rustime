import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TimeSeriesTooltipBody,
  type TimeSeriesTooltipBodyProps,
} from "./ChartTooltip";

type Coordinate = { x: number; y: number };

type Props = {
  active?: boolean;
  payload?: TimeSeriesTooltipBodyProps["payload"];
  label?: string | number;
  coordinate?: Coordinate;
  chartRootRef: React.RefObject<HTMLDivElement | null>;
  bucketSeconds?: number;
};

const VIEWPORT_MARGIN = 8;
const POINTER_OFFSET = 12;

/**
 * Rendert den Zeitverlauf-Tooltip per Portal mit `position: fixed`,
 * damit er nicht von overflow-Containern abgeschnitten wird und
 * bei Bedarf innerhalb des Viewports umklappt.
 */
export function TimeSeriesTooltipPortal({
  active,
  payload,
  label,
  coordinate,
  chartRootRef,
  bucketSeconds,
}: Props) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!active || !coordinate || !chartRootRef.current || !tooltipRef.current) {
      setPosition(null);
      return;
    }

    const wrapper =
      chartRootRef.current.querySelector<HTMLElement>(".recharts-wrapper") ??
      chartRootRef.current;
    const chartRect = wrapper.getBoundingClientRect();
    const tipRect = tooltipRef.current.getBoundingClientRect();

    let left = chartRect.left + coordinate.x + POINTER_OFFSET;
    let top = chartRect.top + coordinate.y + POINTER_OFFSET;

    if (left + tipRect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = chartRect.left + coordinate.x - tipRect.width - POINTER_OFFSET;
    }
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - tipRect.width - VIEWPORT_MARGIN),
    );

    if (top + tipRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = chartRect.top + coordinate.y - tipRect.height - POINTER_OFFSET;
    }
    top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(top, window.innerHeight - tipRect.height - VIEWPORT_MARGIN),
    );

    setPosition({ left, top });
  }, [active, coordinate, payload, label, chartRootRef]);

  if (!active || !payload?.length) {
    return null;
  }

  const tooltip = (
    <div
      ref={tooltipRef}
      className="chartTooltipPortal"
      style={{
        position: "fixed",
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? "visible" : "hidden",
        zIndex: 10000,
        pointerEvents: "none",
      }}
    >
      <TimeSeriesTooltipBody
        active={active}
        payload={payload}
        label={label}
        bucketSeconds={bucketSeconds}
      />
    </div>
  );

  return createPortal(tooltip, document.body);
}
