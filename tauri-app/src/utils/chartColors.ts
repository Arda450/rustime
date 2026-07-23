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

/** Recharts-Tooltip: kompakt, gut lesbar; hoher z-index für Portal-Rendering.
 * Text nutzt var(--text) statt der Serienfarbe (bessere Lesbarkeit, Dark/Light). */
export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--surface-strong)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: "6px",
    padding: "6px 9px",
    fontSize: "0.78rem",
    lineHeight: 1.25,
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.22)",
  },
  wrapperStyle: {
    outline: "none",
    overflow: "visible",
    maxHeight: "none",
    zIndex: 10000,
    pointerEvents: "none",
  },
  itemStyle: {
    padding: "1px 0",
    fontSize: "0.78rem",
    color: "var(--text)",
  },
  labelStyle: {
    color: "var(--muted)",
    fontSize: "0.72rem",
    fontWeight: 700,
    marginBottom: "3px",
  },
} as const;
