import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { zipSync } from 'fflate';
import { buildGuides, calibrationLabel, placeCalibration, type CutStyle, type Guides } from '../layout/guides';
import type { Sheet } from '../layout/pack';
import { renderCell, type Person } from '../person';
import { mmToPt, mmToPx, PRINT_DPI } from '../units';
import { setJpegDpi, setPngDpi } from './dpi';

import type { ExportFormat } from './formats';

export interface ExportJob {
  sheets: Sheet[];
  people: Person[];
  cutStyle: CutStyle;
  calibration: boolean;
}

export interface ExportFile {
  name: string;
  blob: Blob;
}

const MARK_COLOR = { r: 0.1, g: 0.1, b: 0.1 };
const LINE_COLOR = { r: 0.62, g: 0.62, b: 0.62 };

/** Renders each distinct person × size once and reuses it for every copy. */
function cellCache(people: Person[], dpi: number) {
  const byId = new Map(people.map(p => [p.id, p]));
  const cache = new Map<string, HTMLCanvasElement>();
  return (personId: string, size: Sheet['placements'][number]['item']['size']) => {
    const key = `${personId}|${size.key}|${size.widthMm}x${size.heightMm}`;
    let canvas = cache.get(key);
    if (!canvas) {
      canvas = renderCell(byId.get(personId)!, size, dpi);
      cache.set(key, canvas);
    }
    return { key, canvas };
  };
}

export async function exportPdf(job: ExportJob): Promise<Uint8Array> {
  if (!job.sheets.length) throw new Error('There are no sheets to export.');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Sylvi print sheet');
  pdf.setCreator('Sylvi');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const cells = cellCache(job.people, PRINT_DPI);
  const embedded = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();

  for (const sheet of job.sheets) {
    const page = pdf.addPage([mmToPt(sheet.widthMm), mmToPt(sheet.heightMm)]);
    const H = mmToPt(sheet.heightMm);

    for (const p of sheet.placements) {
      const { key, canvas } = cells(p.item.personId, p.item.size);
      let image = embedded.get(key);
      if (!image) {
        const bytes = await canvasBytes(canvas, 'image/jpeg', 0.95);
        image = await pdf.embedJpg(bytes);
        embedded.set(key, image);
      }
      // PDF origin is bottom-left.
      page.drawImage(image, { x: mmToPt(p.x), y: H - mmToPt(p.y + p.h), width: mmToPt(p.w), height: mmToPt(p.h) });
    }

    const guides = buildGuides(sheet, job.cutStyle);
    const color = guides.tone === 'mark' ? MARK_COLOR : LINE_COLOR;
    for (const s of guides.segments) {
      page.drawLine({
        start: { x: mmToPt(s.x1), y: H - mmToPt(s.y1) },
        end: { x: mmToPt(s.x2), y: H - mmToPt(s.y2) },
        thickness: mmToPt(guides.stroke),
        color: rgb(color.r, color.g, color.b)
      });
    }

    const cal = job.calibration ? placeCalibration(sheet) : null;
    if (cal) {
      const y = H - mmToPt(cal.y);
      const x1 = mmToPt(cal.x);
      const x2 = mmToPt(cal.x + cal.length);
      const ink = rgb(MARK_COLOR.r, MARK_COLOR.g, MARK_COLOR.b);
      const t = mmToPt(0.15);
      page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color: ink });
      page.drawLine({ start: { x: x1, y: y - 3 }, end: { x: x1, y: y + 3 }, thickness: t, color: ink });
      page.drawLine({ start: { x: x2, y: y - 3 }, end: { x: x2, y: y + 3 }, thickness: t, color: ink });
      page.drawText(calibrationLabel(sheet, cal), { x: x2 + 4, y: y - 2, size: 5.5, font, color: ink });
    }
  }
  return pdf.save();
}

/** Draws a whole sheet onto a canvas at `dpi` (used for PNG/JPG and thumbnails). */
export function renderSheetCanvas(sheet: Sheet, job: ExportJob, dpi: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(mmToPx(sheet.widthMm, dpi));
  canvas.height = Math.round(mmToPx(sheet.heightMm, dpi));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const px = (mm: number) => mmToPx(mm, dpi);
  const cells = cellCache(job.people, dpi);

  for (const p of sheet.placements) {
    const { canvas: cell } = cells(p.item.personId, p.item.size);
    ctx.drawImage(cell, px(p.x), px(p.y), px(p.w), px(p.h));
  }
  drawGuides(ctx, buildGuides(sheet, job.cutStyle), px);

  const cal = job.calibration ? placeCalibration(sheet) : null;
  if (cal) {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1, px(0.15));
    ctx.beginPath();
    ctx.moveTo(px(cal.x), px(cal.y));
    ctx.lineTo(px(cal.x + cal.length), px(cal.y));
    for (const x of [cal.x, cal.x + cal.length]) {
      ctx.moveTo(px(x), px(cal.y - 1));
      ctx.lineTo(px(x), px(cal.y + 1));
    }
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `${px(2)}px Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(calibrationLabel(sheet, cal), px(cal.x + cal.length + 1.5), px(cal.y));
  }
  return canvas;
}

function drawGuides(ctx: CanvasRenderingContext2D, guides: Guides, px: (mm: number) => number) {
  if (!guides.segments.length) return;
  ctx.strokeStyle = guides.tone === 'mark' ? '#1a1a1a' : '#9e9e9e';
  ctx.lineWidth = Math.max(1, px(guides.stroke));
  ctx.beginPath();
  for (const s of guides.segments) {
    ctx.moveTo(px(s.x1), px(s.y1));
    ctx.lineTo(px(s.x2), px(s.y2));
  }
  ctx.stroke();
}

export async function exportFiles(job: ExportJob, format: ExportFormat, baseName: string): Promise<ExportFile> {
  if (!job.sheets.length) throw new Error('There are no sheets to export.');
  if (format === 'pdf') {
    const bytes = await exportPdf(job);
    return { name: `${baseName}.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) };
  }

  const type = format === 'png' ? 'image/png' : 'image/jpeg';
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (const [i, sheet] of job.sheets.entries()) {
    const canvas = renderSheetCanvas(sheet, job, PRINT_DPI);
    const raw = await canvasBytes(canvas, type, 0.95);
    const bytes = format === 'png' ? setPngDpi(raw, PRINT_DPI) : setJpegDpi(raw, PRINT_DPI);
    const suffix = job.sheets.length > 1 ? `-sheet-${i + 1}` : '';
    files.push({ name: `${baseName}${suffix}.${format}`, bytes });
  }
  if (files.length === 1) return { name: files[0].name, blob: new Blob([files[0].bytes as BlobPart], { type }) };

  const zip = zipSync(Object.fromEntries(files.map(f => [f.name, f.bytes])), { level: 0 });
  return { name: `${baseName}.zip`, blob: new Blob([zip as BlobPart], { type: 'application/zip' }) };
}

export function downloadFile(file: ExportFile): void {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Opens the browser's print dialog for the sheet PDF. */
export async function printPdf(bytes: Uint8Array): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
  const cleanup = () => {
    frame.remove();
    URL.revokeObjectURL(url);
  };
  let loadTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const failed = () => reject(new Error('The PDF couldn’t load for printing.'));
      loadTimeout = setTimeout(failed, 15_000);
      frame.onerror = failed;
      frame.onload = () => {
        clearTimeout(loadTimeout);
        try {
          if (!frame.contentWindow) throw new Error('The print frame is unavailable.');
          frame.contentWindow.focus();
          frame.contentWindow.print();
          resolve();
        } catch {
          try {
            // Some browsers block printing embedded PDFs.
            if (!window.open(url, '_blank')) throw new Error('Printing was blocked. Download the PDF instead.');
            resolve();
          } catch (error) { reject(error); }
        }
      };
      frame.src = url;
      document.body.append(frame);
    });
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    clearTimeout(loadTimeout);
    frame.onload = null;
    frame.onerror = null;
  }
  setTimeout(cleanup, 60_000);
}

function canvasBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? blob.arrayBuffer().then(b => resolve(new Uint8Array(b)), reject) : reject(new Error('Export failed'))),
      type,
      quality
    )
  );
}

export function exportBaseName(people: Person[]): string {
  const stamp = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
  const who = people.length === 1 ? slug(people[0].name) : people.length > 1 ? `${people.length}-people` : 'photos';
  return `sylvi-${who || 'photo'}-${date}`;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
