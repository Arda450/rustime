import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import type { ChartLegendEntry } from "../utils/chartLegend";
import type { ReportKpi } from "./ReportBody";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_Y = 287;

export type ReportPdfChartSection = {
  title: string;
  hint?: string;
  captureEl: HTMLElement | null;
  legendEntries: ChartLegendEntry[];
  maxImageHeightMm?: number;
};

export type BuildReportPdfOptions = {
  subtitle: string;
  narrative: string | null;
  kpis: ReportKpi[];
  estimationHint: string;
  sections: ReportPdfChartSection[];
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return [120, 120, 120];
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function surfaceBackgroundColor(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--surface")
    .trim();
  return raw || "#ffffff";
}

async function waitForPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function captureElement(el: HTMLElement): Promise<string> {
  await waitForPaint();
  return toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: surfaceBackgroundColor(),
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Chart-Bild konnte nicht geladen werden."));
    img.src = dataUrl;
  });
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addFooters(doc: jsPDF, estimationHint: string): void {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    const footerLines = doc.splitTextToSize(estimationHint, CONTENT_W);
    doc.text(footerLines, MARGIN, PAGE_H - 8);
    doc.text(`Seite ${page} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, {
      align: "right",
    });
  }
}

function addLegend(
  doc: jsPDF,
  y: number,
  entries: ChartLegendEntry[],
): number {
  if (entries.length === 0) {
    return y;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const visible = entries.slice(0, 14);
  for (const entry of visible) {
    y = ensureSpace(doc, y, 5);
    const [r, g, b] = hexToRgb(entry.color);
    doc.setFillColor(r, g, b);
    doc.rect(MARGIN, y - 3, 3, 3, "F");
    doc.setTextColor(40);
    const line = `${entry.name} — ${entry.meta}`;
    const wrapped = doc.splitTextToSize(line, CONTENT_W - 6);
    doc.text(wrapped, MARGIN + 5, y);
    y += wrapped.length * 3.6;
  }

  if (entries.length > visible.length) {
    y = ensureSpace(doc, y, 5);
    doc.setTextColor(100);
    doc.text(
      `… und ${entries.length - visible.length} weitere`,
      MARGIN,
      y,
    );
    y += 4;
  }

  return y + 2;
}

async function addImageSection(
  doc: jsPDF,
  y: number,
  section: ReportPdfChartSection,
  dataUrl: string,
): Promise<number> {
  y = ensureSpace(doc, y, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(section.title, MARGIN, y);
  y += 5;

  if (section.hint) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    const hintLines = doc.splitTextToSize(section.hint, CONTENT_W);
    doc.text(hintLines, MARGIN, y);
    y += hintLines.length * 3.5 + 2;
  }

  const img = await loadImage(dataUrl);
  const maxHeight = section.maxImageHeightMm ?? 88;
  let displayW = CONTENT_W;
  let displayH = (img.height / img.width) * displayW;
  if (displayH > maxHeight) {
    displayH = maxHeight;
    displayW = (img.width / img.height) * displayH;
  }

  y = ensureSpace(doc, y, displayH + 6);
  doc.addImage(dataUrl, "PNG", MARGIN, y, displayW, displayH);
  y += displayH + 4;
  return addLegend(doc, y, section.legendEntries);
}

function addKpis(doc: jsPDF, y: number, kpis: ReportKpi[]): number {
  if (kpis.length === 0) {
    return y;
  }

  y = ensureSpace(doc, y, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text("Kennzahlen", MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  for (const kpi of kpis) {
    y = ensureSpace(doc, y, 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(kpi.value, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(kpi.label, MARGIN + 42, y);
    y += 5;
  }

  return y + 4;
}

export async function buildReportPdf(
  options: BuildReportPdfOptions,
): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("Rustime Bericht", MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  const subtitleLines = doc.splitTextToSize(options.subtitle, CONTENT_W);
  doc.text(subtitleLines, MARGIN, y);
  y += subtitleLines.length * 4.5 + 4;

  if (options.narrative) {
    doc.setFontSize(10);
    doc.setTextColor(30);
    const narrativeLines = doc.splitTextToSize(options.narrative, CONTENT_W);
    for (const line of narrativeLines) {
      y = ensureSpace(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 4;
  }

  y = addKpis(doc, y, options.kpis);

  for (const section of options.sections) {
    if (!section.captureEl) {
      continue;
    }
    try {
      const png = await captureElement(section.captureEl);
      y = await addImageSection(doc, y, section, png);
      y += 6;
    } catch (error) {
      console.warn("PDF chart capture failed:", section.title, error);
    }
  }

  addFooters(doc, options.estimationHint);
  return new Uint8Array(doc.output("arraybuffer"));
}
