import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
  const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
  return `${safePrefix}-${timestamp}.${extension}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export function createExcelBuffer(rows: ExportRow[], sheetName: string): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(normalizeRows(rows));

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const arrayBuffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  });

  return toArrayBuffer(new Uint8Array(arrayBuffer as ArrayBufferLike));
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

  page.drawText(`Generated at: ${new Date().toISOString()}`, {
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
