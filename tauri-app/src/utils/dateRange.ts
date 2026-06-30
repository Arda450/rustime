/** Lokales Datum als YYYY-MM-DD. */
export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lokales Datum (YYYY-MM-DD) → Unix-Sekunden Tagesbeginn 00:00:00. */
export function dateInputToFromTs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d, 0, 0, 0).getTime() / 1000);
}

/** Lokales Datum (YYYY-MM-DD) → Unix-Sekunden Tagesende 23:59:59. */
export function dateInputToToTs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000);
}

/** Verschiebt ein ISO-Datum um `delta` Tage. */
export function addDaysIso(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** z. B. «Montag, 07.06.2026» */
export function formatIsoDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  return `${weekday}, ${formatIsoDate(iso)}`;
}

export function formatTimeFromTs(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Begrenzt ein ISO-Datum auf heute (lokal). */
export function clampIsoDateToToday(isoDate: string): string {
  const today = todayIsoDate();
  return isoDate > today ? today : isoDate;
}

export function isIsoDateBeforeToday(isoDate: string): boolean {
  return isoDate < todayIsoDate();
}

/** Montag als Wochenstart (lokale Kalenderwoche). */
export function weekStartIso(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/** Sonntag als Wochenende. */
export function weekEndIso(isoDate: string): string {
  return addDaysIso(weekStartIso(isoDate), 6);
}

export function addWeeks(isoDate: string, delta: number): string {
  return addDaysIso(isoDate, delta * 7);
}

/** ISO-Kalenderwoche (1–53) aus einem Datum. */
export function isoWeekNumber(isoDate: string): number {
  const start = weekStartIso(isoDate);
  const [y, m, d] = start.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
}

export function clampWeekEndToToday(weekEnd: string): string {
  const today = todayIsoDate();
  return weekEnd > today ? today : weekEnd;
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${formatIsoDate(weekStart)} – ${formatIsoDate(weekEnd)}`;
}

export function formatWeekLabel(anchorIso: string): string {
  const start = weekStartIso(anchorIso);
  const end = weekEndIso(anchorIso);
  const effectiveEnd = clampWeekEndToToday(end);
  return `KW ${isoWeekNumber(start)} · ${formatWeekRange(start, effectiveEnd)}`;
}

export function isCurrentWeek(anchorIso: string): boolean {
  return weekStartIso(anchorIso) === weekStartIso(todayIsoDate());
}

export function isWeekFullyInPast(anchorIso: string): boolean {
  return weekEndIso(anchorIso) < todayIsoDate();
}
