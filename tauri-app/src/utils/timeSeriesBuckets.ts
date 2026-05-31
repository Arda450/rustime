/** Wählt die Bucket-Grösse passend zum sichtbaren Zeitraum (mehr Punkte = lesbarer). */
export function chooseBucketSeconds(spanSeconds: number): number {
  if (spanSeconds <= 45 * 60) return 60;
  if (spanSeconds <= 3 * 60 * 60) return 120;
  if (spanSeconds <= 8 * 60 * 60) return 300;
  return 900;
}

export function formatBucketLabel(bucketSeconds: number): string {
  if (bucketSeconds < 60) return `${bucketSeconds} Sekunden`;
  if (bucketSeconds % 60 === 0) {
    const min = bucketSeconds / 60;
    return min === 1 ? "1 Minute" : `${min} Minuten`;
  }
  return `${bucketSeconds} Sekunden`;
}
