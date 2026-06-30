/** Gemeinsame Dwell-Parameter für Tages- und Wochenberichte. */
export const REPORT_DWELL_OPTS = {
  maxSegmentGapSeconds: 120,
  tailSeconds: 2,
} as const;

export const DAILY_TIMELINE_BUCKET_SECONDS = 900;
export const WEEKLY_TIMELINE_BUCKET_SECONDS = 86_400;

export const REPORT_ESTIMATION_HINT =
  "Geschätzte aktive Zeit aus 2-Sekunden-Samples; Pausen über 2 Minuten werden begrenzt angerechnet.";
