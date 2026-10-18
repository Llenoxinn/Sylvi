import type { PhotoSize } from '../sizes';

/**
 * Guillotine shelf packer.
 *
 * Photos are laid out in shelves (rows of one size) that span the region they
 * sit in, and any space left at the end of a shelf is packed recursively with
 * smaller photos. Because every split runs edge to edge across its region,
 * the finished sheet can always be separated with straight cuts on a trimmer.
 */

export interface PackItem {
  id: string;
  personId: string;
  size: PhotoSize;
  /** Optional items fill leftover space and never cause an extra sheet. */
  optional?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placement extends Rect {
  item: PackItem;
}

/** A straight cut along `axis` at `pos`, running from `from` to `to` (mm). */
export interface Cut {
  axis: 'h' | 'v';
  pos: number;
  from: number;
  to: number;
}

export interface Sheet {
  widthMm: number;
  heightMm: number;
  orientation: 'portrait' | 'landscape';
  printable: Rect;
  placements: Placement[];
  cuts: Cut[];
}

export interface PackOptions {
  paperWidthMm: number;
  paperHeightMm: number;
  marginMm: number;
  gapMm: number;
  orientation: 'auto' | 'portrait' | 'landscape';
}

export interface PackResult {
  sheets: Sheet[];
  /** Photos too large for the printable area of this paper. */
  unplaced: PackItem[];
}

const EPS = 1e-6;

export function pack(items: PackItem[], options: PackOptions): PackResult {
  const short = Math.min(options.paperWidthMm, options.paperHeightMm);
  const long = Math.max(options.paperWidthMm, options.paperHeightMm);
  const portrait = () => packAll(items, short, long, 'portrait', options);
  const landscape = () => packAll(items, long, short, 'landscape', options);

  if (options.orientation === 'portrait') return portrait();
  if (options.orientation === 'landscape') return landscape();

  const p = portrait();
  const l = landscape();
  return score(l) > score(p) ? l : p;
}

/** Higher is better: everything placed, fewest sheets, most fill photos. */
function score(result: PackResult): number {
  const placed = result.sheets.reduce((n, s) => n + s.placements.length, 0);
  return -result.unplaced.length * 1e6 - result.sheets.length * 1e3 + placed;
}

function packAll(
  items: PackItem[],
  widthMm: number,
  heightMm: number,
  orientation: Sheet['orientation'],
  { marginMm, gapMm }: PackOptions
): PackResult {
  const printable: Rect = {
    x: marginMm,
    y: marginMm,
    w: Math.max(0, widthMm - marginMm * 2),
    h: Math.max(0, heightMm - marginMm * 2)
  };
  const fits = (it: PackItem) => it.size.widthMm <= printable.w + EPS && it.size.heightMm <= printable.h + EPS;

  const unplaced = items.filter(it => !fits(it) && !it.optional);
  let required = sortForPacking(items.filter(it => fits(it) && !it.optional));
  const optional = sortForPacking(items.filter(it => fits(it) && it.optional));
  const sheets: Sheet[] = [];

  const newSheet = (): Sheet => ({ widthMm, heightMm, orientation, printable, placements: [], cuts: [] });

  while (required.length > 0) {
    const sheet = newSheet();
    const queue = [...required];
    packRegion(printable, queue, gapMm, sheet);
    if (sheet.placements.length === 0) break; // cannot happen once oversize items are filtered, but never loop forever
    required = queue;
    if (required.length === 0 && optional.length > 0) {
      // Last sheet: re-pack it with the fill photos as well.
      const filled = newSheet();
      const fillQueue = sortForPacking([...sheet.placements.map(p => p.item), ...optional]);
      packRegion(printable, fillQueue, gapMm, filled);
      const allRequiredPlaced = fillQueue.every(it => it.optional);
      sheets.push(allRequiredPlaced ? filled : sheet);
    } else {
      sheets.push(sheet);
    }
  }

  if (sheets.length === 0 && optional.length > 0) {
    const sheet = newSheet();
    packRegion(printable, [...optional], gapMm, sheet);
    sheets.push(sheet);
  }

  for (const sheet of sheets) sheet.cuts = mergeCuts(sheet.cuts);
  return { sheets, unplaced };
}

/** Required before optional, then biggest first, keeping input order within a size. */
function sortForPacking(items: PackItem[]): PackItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (!!a.item.optional !== !!b.item.optional) return a.item.optional ? 1 : -1;
      const area = b.item.size.widthMm * b.item.size.heightMm - a.item.size.widthMm * a.item.size.heightMm;
      if (Math.abs(area) > EPS) return area;
      const height = b.item.size.heightMm - a.item.size.heightMm;
      if (Math.abs(height) > EPS) return height;
      return a.index - b.index;
    })
    .map(entry => entry.item);
}

const sameSize = (a: PhotoSize, b: PhotoSize) =>
  Math.abs(a.widthMm - b.widthMm) < EPS && Math.abs(a.heightMm - b.heightMm) < EPS;

/** Packs as much of `queue` as fits into `region`, removing placed items from it. */
function packRegion(region: Rect, queue: PackItem[], gap: number, sheet: Sheet): void {
  let y = region.y;
  const bottom = region.y + region.h;

  while (queue.length > 0) {
    const room = bottom - y;
    const first = queue.find(it => it.size.widthMm <= region.w + EPS && it.size.heightMm <= room + EPS);
    if (!first) return;

    const { widthMm: w, heightMm: h } = first.size;
    const perRow = Math.max(1, Math.floor((region.w + gap + EPS) / (w + gap)));
    const row: PackItem[] = [];
    for (let i = 0; i < queue.length && row.length < perRow; ) {
      if (sameSize(queue[i].size, first.size)) row.push(...queue.splice(i, 1));
      else i++;
    }

    row.forEach((item, i) => {
      const x = region.x + i * (w + gap);
      sheet.placements.push({ item, x, y, w, h });
      sheet.cuts.push({ axis: 'v', pos: x, from: y, to: y + h }, { axis: 'v', pos: x + w, from: y, to: y + h });
    });
    sheet.cuts.push(
      { axis: 'h', pos: y, from: region.x, to: region.x + region.w },
      { axis: 'h', pos: y + h, from: region.x, to: region.x + region.w }
    );

    // Fill the end of the shelf with whatever smaller photos fit there.
    const used = row.length * (w + gap);
    if (region.w - used > EPS) packRegion({ x: region.x + used, y, w: region.w - used, h }, queue, gap, sheet);

    y += h + gap;
  }
}

/** Joins overlapping or touching collinear cuts into single segments. */
export function mergeCuts(cuts: Cut[]): Cut[] {
  const groups = new Map<string, Cut[]>();
  for (const cut of cuts) {
    const key = `${cut.axis}:${cut.pos.toFixed(4)}`;
    const list = groups.get(key);
    if (list) list.push(cut);
    else groups.set(key, [cut]);
  }
  const merged: Cut[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.from - b.from);
    let current = { ...list[0] };
    for (const cut of list.slice(1)) {
      if (cut.from <= current.to + EPS) current.to = Math.max(current.to, cut.to);
      else {
        merged.push(current);
        current = { ...cut };
      }
    }
    merged.push(current);
  }
  return merged;
}
