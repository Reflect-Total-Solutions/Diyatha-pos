import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { formatColomboDate, formatColomboDateTime } from './dateUtils';

export type ExportRowValue = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportRowValue>;

function normalizeRows(rows: ExportRow[]): Record<string, string | number | boolean>[] {
  return rows.map((row) => {
    const normalized: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(row)) {
      normalized[key] = value ?? '';
    }

    return normalized;
  });
}

export function buildReportFilename(prefix: string, extension: 'xlsx' | 'pdf'): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  const timestamp = formatColomboDate(new Date(), 'yyyy-MM-dd-HH-mm-ss');
  return `${safePrefix}-${timestamp}.${extension}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export type ExportSheet = {
  name: string;
  rows: ExportRow[];
};

export function createExcelBufferSheets(sheets: ExportSheet[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(normalizeRows(sheet.rows));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  const arrayBuffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  });

  return toArrayBuffer(new Uint8Array(arrayBuffer as ArrayBufferLike));
}

export function createExcelBuffer(rows: ExportRow[], sheetName: string): ArrayBuffer {
  return createExcelBufferSheets([{ name: sheetName, rows }]);
}

export async function createPdfBuffer(title: string, rows: ExportRow[]): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([842, 595]);
  const margin = 40;
  const lineHeight = 15;
  const baseFontSize = 10;
  let cursorY = page.getHeight() - margin;

  const newPage = () => {
    page = pdf.addPage([842, 595]);
    cursorY = page.getHeight() - margin;
  };

  page.drawText(title, {
    x: margin,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 24;

  page.drawText(`Generated at: ${formatColomboDateTime(new Date())} (Sri Lanka)`, {
    x: margin,
    y: cursorY,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  cursorY -= 20;

  if (rows.length === 0) {
    page.drawText('No data available for selected filters.', {
      x: margin,
      y: cursorY,
      size: baseFontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  rows.forEach((row, index) => {
    const entries = Object.entries(row).map(([key, value]) => `${key}: ${value ?? ''}`).join(' | ');
    const line = `${index + 1}. ${entries}`;

    if (cursorY <= margin + lineHeight) {
      newPage();
    }

    page.drawText(line.slice(0, 1500), {
      x: margin,
      y: cursorY,
      size: baseFontSize,
      font,
      color: rgb(0.15, 0.15, 0.15),
      maxWidth: page.getWidth() - margin * 2,
      lineHeight,
    });

    cursorY -= lineHeight;
  });

  const bytes = await pdf.save();
  return toArrayBuffer(bytes);
}
