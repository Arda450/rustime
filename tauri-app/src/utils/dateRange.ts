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
