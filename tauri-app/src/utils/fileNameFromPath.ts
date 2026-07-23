/** Letzter Pfadteil für kompakte Toast-Details. */
export function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
