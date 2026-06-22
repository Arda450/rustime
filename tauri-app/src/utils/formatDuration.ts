export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes} min ${sec} s`;
  const hours = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${hours} h ${min} min`;
}
