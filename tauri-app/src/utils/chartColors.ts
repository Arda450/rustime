/** Gemeinsame Farbpalette für Pie- und Zeitverlaufs-Charts (Reihenfolge = Legende). */
export const CHART_COLORS = [
  "#4A9EFF",
  "#00C49F",
  "#FFBB28",
  "#FF6B6B",
  "#A78BFA",
  "#F472B6",
  "#34D399",
  "#FB923C",
  "#38BDF8",
  "#E879F9",
  "#FACC15",
  "#2DD4BF",
  "#F87171",
  "#818CF8",
  "#4ADE80",
  "#FBBF24",
];

export function colorForCategoryIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function colorForCategory(
  name: string,
  orderedNames: readonly string[],
): string {
  const idx = orderedNames.indexOf(name);
  return colorForCategoryIndex(idx >= 0 ? idx : orderedNames.length);
}

/** Recharts-Tooltip: kein Scroll, alles sichtbar; hoher z-index für Portal-Rendering. */
export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--surface-strong)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: "6px",
    padding: "10px 12px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
  },
  wrapperStyle: {
    outline: "none",
    overflow: "visible",
    maxHeight: "none",
    zIndex: 10000,
    pointerEvents: "none",
  },
  itemStyle: {
    padding: "2px 0",
  },
} as const;
