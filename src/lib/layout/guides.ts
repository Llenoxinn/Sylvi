import { inToMm } from '../units';
import type { Placement, Sheet } from './pack';

export type CutStyle = 'marks' | 'lines' | 'spaced';

export const CUT_STYLES: { id: CutStyle; label: string; hint: string }[] = [
  { id: 'marks', label: 'Crop marks', hint: 'Short marks where each cut starts and ends' },
  { id: 'lines', label: 'Cut lines', hint: 'A thin line along every cut' },
  { id: 'spaced', label: 'White border', hint: 'A small white gap around each photo, no lines' }
];

/** Gap between photos for each style, in mm. */
export const gapFor = (style: CutStyle) => (style === 'spaced' ? 2 : 0);

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Guides {
  segments: Segment[];
  /** Stroke width in mm. */
  stroke: number;
  /** 'mark' is near-black like a printer's crop mark, 'line' is light grey. */
  tone: 'mark' | 'line';
}

const MARK_LENGTH = 3;
const MARK_OFFSET = 0.8;
const INNER_MARK = 1.6;
const EPS = 1e-4;

export function buildGuides(sheet: Sheet, style: CutStyle): Guides {
  if (style === 'spaced') return { segments: [], stroke: 0, tone: 'line' };

  if (style === 'lines') {
    const segments = sheet.cuts.map(c =>
      c.axis === 'h' ? { x1: c.from, y1: c.pos, x2: c.to, y2: c.pos } : { x1: c.pos, y1: c.from, x2: c.pos, y2: c.to }
    );
    return { segments, stroke: 0.12, tone: 'line' };
  }

  // Crop marks: at each end of every cut, a mark outside the photos when there
  // is room, otherwise a short mark on the cut line itself.
  const segments: Segment[] = [];
  const seen = new Set<string>();
  const add = (s: Segment) => {
    const key = [s.x1, s.y1, s.x2, s.y2].map(v => v.toFixed(3)).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      segments.push(s);
    }
  };

  for (const cut of sheet.cuts) {
    for (const dir of [-1, 1] as const) {
      const end = dir < 0 ? cut.from : cut.to;
      const room = freeRun(sheet, cut.axis, cut.pos, end, dir);
      let a: number;
      let b: number;
      if (room >= MARK_OFFSET + 1.2) {
        a = end + dir * MARK_OFFSET;
        b = end + dir * Math.min(MARK_OFFSET + MARK_LENGTH, room - 0.3);
      } else {
        a = end;
        b = end - dir * INNER_MARK;
      }
      add(cut.axis === 'h' ? { x1: a, y1: cut.pos, x2: b, y2: cut.pos } : { x1: cut.pos, y1: a, x2: cut.pos, y2: b });
    }
  }
  return { segments, stroke: 0.1, tone: 'mark' };
}

/** Free distance along a cut line beyond `from`, until a photo or the paper edge. */
function freeRun(sheet: Sheet, axis: 'h' | 'v', pos: number, from: number, dir: -1 | 1): number {
  const limit = axis === 'h' ? (dir < 0 ? 0 : sheet.widthMm) : dir < 0 ? 0 : sheet.heightMm;
  let run = Math.abs(limit - from);
  for (const p of sheet.placements) {
    if (!crosses(p, axis, pos)) continue;
    const near = axis === 'h' ? (dir < 0 ? p.x + p.w : p.x) : dir < 0 ? p.y + p.h : p.y;
    const dist = (near - from) * dir;
    if (dist >= -EPS) run = Math.min(run, Math.max(0, dist));
  }
  return run;
}

/** True when the line strictly passes through the photo (not along its edge). */
function crosses(p: Placement, axis: 'h' | 'v', pos: number): boolean {
  return axis === 'h' ? pos > p.y + EPS && pos < p.y + p.h - EPS : pos > p.x + EPS && pos < p.x + p.w - EPS;
}

export interface CalibrationMark {
  x: number;
  y: number;
  length: number;
}

/** Where a 1-inch check line fits below the photos, or null if there is no room. */
export function placeCalibration(sheet: Sheet): CalibrationMark | null {
  const length = inToMm(1);
  const bottom = Math.max(0, ...sheet.placements.map(p => p.y + p.h));
  const free = sheet.heightMm - bottom;
  // Sit below the crop marks that hang under the photos, and clear of the paper edge.
  const below = MARK_OFFSET + MARK_LENGTH + 2.2;
  if (free < below + 2.5 || sheet.widthMm < length + 6) return null;
  const left = sheet.placements.length ? Math.min(...sheet.placements.map(p => p.x)) : sheet.printable.x;
  return { x: Math.max(3, left), y: bottom + below, length };
}

/** The label beside the check line, shortened when the sheet is narrow. */
export function calibrationLabel(sheet: Sheet, mark: CalibrationMark): string {
  const room = sheet.widthMm - (mark.x + mark.length) - 3;
  return room >= 52 ? '1 inch. Measure it to check the print size.' : '1 inch';
}
