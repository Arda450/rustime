/**
 * Wählt die Bucket-Grösse passend zum sichtbaren Zeitraum.
 * Längere Spannen → grössere Buckets, damit der Chart lesbar bleibt.
 */
export function chooseBucketSeconds(spanSeconds: number): number {
  if (spanSeconds <= 45 * 60) return 60; // bis 45 min: 1 min
  if (spanSeconds <= 3 * 60 * 60) return 120; // bis 3 h: 2 min
  if (spanSeconds <= 8 * 60 * 60) return 300; // bis 8 h: 5 min
  return 900; // bis 24 h und mehr: 15 min
}

export function formatBucketLabel(bucketSeconds: number): string {
  if (bucketSeconds >= 86_400 && bucketSeconds % 86_400 === 0) {
    const days = bucketSeconds / 86_400;
    return days === 1 ? "1 Tag" : `${days} Tage`;
  }
  if (bucketSeconds < 60) return `${bucketSeconds} Sekunden`;
  if (bucketSeconds % 60 === 0) {
    const min = bucketSeconds / 60;
    return min === 1 ? "1 Minute" : `${min} Minuten`;
  }
  return `${bucketSeconds} Sekunden`;
}

export const SECONDS_PER_DAY = 86_400;

/** X-Achsen-Label: Uhrzeit für kurze Buckets, Datum für Tages-Buckets (Wochenbericht). */
export function formatTimeSeriesAxisLabel(
  ts: number,
  bucketSeconds: number,
): string {
  const d = new Date(ts * 1000);
  if (bucketSeconds >= SECONDS_PER_DAY) {
    const weekday = d.toLocaleDateString("de-CH", { weekday: "short" });
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${weekday} ${day}.${month}.`;
  }
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export type TimeSeriesValueUnit = {
  /** Sekunden in den Anzeigewert umrechnen (auf 2 Nachkommastellen gerundet). */
  secondsToValue: (seconds: number) => number;
  /** Anzeigewert zurück in Sekunden (für Tooltip/Dauerformatierung). */
  valueToSeconds: (value: number) => number;
  /** Beschriftung der Y-Achse. */
  axisLabel: string;
  /** Einheit für Fliesstext/Caption. */
  captionUnit: string;
};

/**
 * Wählt die Anzeige-Einheit passend zur Bucket-Grösse.
 * Tages-Buckets (Wochenbericht) → Stunden, sonst Minuten (lesbarer).
 */
export function timeSeriesValueUnit(bucketSeconds: number): TimeSeriesValueUnit {
  if (bucketSeconds >= SECONDS_PER_DAY) {
    return {
      secondsToValue: (s) => Math.round((s / 3_600) * 100) / 100,
      valueToSeconds: (v) => v * 3_600,
      axisLabel: "Std / Fenster",
      captionUnit: "Stunden",
    };
  }
  return {
    secondsToValue: (s) => Math.round((s / 60) * 100) / 100,
    valueToSeconds: (v) => v * 60,
    axisLabel: "Min / Fenster",
    captionUnit: "Minuten",
  };
}

/** Tooltip-Titel passend zum Bucket-Typ. */
export function formatTimeSeriesTooltipTitle(
  ts: number,
  bucketSeconds: number,
  fallbackLabel?: string | number,
): string {
  if (bucketSeconds >= SECONDS_PER_DAY) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return String(fallbackLabel ?? "");
}
