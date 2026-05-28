import type { Activity } from "../types";
import { formatContextLabel, parseWindowContext } from "./WindowContext";

export type DwellPieSegment = { name: string; value: number };

export type DwellByCategoryOptions = {
  maxSegmentGapSeconds?: number;
  tailSeconds?: number;
  categorize?: (title: string) => string;
  topN?: number;
};

const DEFAULT_MAX_GAP = 120;
const DEFAULT_TAIL = 2;
const DEFAULT_TOP_N = 10;

export function defaultCategorizeTitle(title: string): string {
  return formatContextLabel(parseWindowContext(title));
}

export function dwellByCategory(
  activities: Activity[],
  projectId: number,
  options?: DwellByCategoryOptions,
): DwellPieSegment[] {
  const maxGap = options?.maxSegmentGapSeconds ?? DEFAULT_MAX_GAP;
  const tail = options?.tailSeconds ?? DEFAULT_TAIL;
  const categorize = options?.categorize ?? defaultCategorizeTitle;
  const topN = options?.topN ?? DEFAULT_TOP_N;

  const rows = activities
    .filter((a) => a.project_id === projectId)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (rows.length === 0) return [];

  const totals = new Map<string, number>();

  if (rows.length === 1) {
    const cat = categorize(rows[0].title);
    totals.set(cat, (totals.get(cat) ?? 0) + tail);
  } else {
    for (let i = 0; i < rows.length - 1; i++) {
      const rawDelta = rows[i + 1].timestamp - rows[i].timestamp;
      const delta = Math.min(Math.max(0, rawDelta), maxGap);
      const cat = categorize(rows[i].title);
      totals.set(cat, (totals.get(cat) ?? 0) + delta);
    }

    const last = rows[rows.length - 1];
    const lastCat = categorize(last.title);
    totals.set(lastCat, (totals.get(lastCat) ?? 0) + tail);
  }

  let segments: DwellPieSegment[] = [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  if (topN > 0 && segments.length > topN) {
    const head = segments.slice(0, topN);
    const rest = segments.slice(topN);
    const otherSum = rest.reduce((sum, s) => sum + s.value, 0);
    if (otherSum > 0) {
      head.push({ name: "Sonstige", value: otherSum });
    }
    segments = head;
  }

  return segments;
}

export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes} min ${sec} s`;
  const hours = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${hours} h ${min} min`;
}
