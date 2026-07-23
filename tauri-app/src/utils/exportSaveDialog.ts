import { save } from "@tauri-apps/plugin-dialog";

type SaveExportOptions = {
  title: string;
  defaultFileName: string;
  extension: string;
  filterName: string;
};

/** Öffnet den System-Speicherndialog. `null` = Abbruch. */
export async function pickExportSavePath(
  options: SaveExportOptions,
): Promise<string | null> {
  return save({
    title: options.title,
    defaultPath: options.defaultFileName,
    filters: [
      {
        name: options.filterName,
        extensions: [options.extension],
      },
    ],
  });
}

/** Zweite CSV-Datei im selben Ordner neben der Samples-Datei. */
export function aggregatedCsvPathBeside(samplesPath: string): string {
  if (/samples/i.test(samplesPath)) {
    return samplesPath.replace(/samples/gi, "aggregated");
  }
  if (/\.csv$/i.test(samplesPath)) {
    return samplesPath.replace(/\.csv$/i, "-aggregated.csv");
  }
  return `${samplesPath}-aggregated.csv`;
}

export function defaultExportFileName(
  prefix: string,
  extension: string,
): string {
  const stamp = Math.floor(Date.now() / 1000);
  return `${prefix}-${stamp}.${extension}`;
}
