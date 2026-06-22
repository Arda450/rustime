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
  if (bucketSeconds < 60) return `${bucketSeconds} Sekunden`;
  if (bucketSeconds % 60 === 0) {
    const min = bucketSeconds / 60;
    return min === 1 ? "1 Minute" : `${min} Minuten`;
  }
  return `${bucketSeconds} Sekunden`;
}
