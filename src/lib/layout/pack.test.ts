import { describe, expect, it } from 'vitest';
import { BUILT_IN_PACKAGES } from '../packages';
import { PAPERS } from '../papers';
import { buildPackItems } from './items';
import { pack, type PackOptions, type Sheet } from './pack';

const paper = (id: string) => PAPERS.find(p => p.id === id)!;
const pkg = (id: string) => BUILT_IN_PACKAGES.find(p => p.id === id)!;

function options(paperId: string, extra: Partial<PackOptions> = {}): PackOptions {
  const p = paper(paperId);
  return { paperWidthMm: p.widthMm, paperHeightMm: p.heightMm, marginMm: p.marginMm, gapMm: 0, orientation: 'auto', ...extra };
}

function packPackage(pkgIds: string[], opts: PackOptions) {
  const people = pkgIds.map((id, i) => ({ personId: `p${i}`, pkg: pkg(id) }));
  return pack(buildPackItems(people, opts.paperWidthMm * opts.paperHeightMm), opts);
}

function expectValidSheet(sheet: Sheet) {
  const eps = 1e-6;
  for (const p of sheet.placements) {
    expect(p.x).toBeGreaterThanOrEqual(sheet.printable.x - eps);
    expect(p.y).toBeGreaterThanOrEqual(sheet.printable.y - eps);
    expect(p.x + p.w).toBeLessThanOrEqual(sheet.printable.x + sheet.printable.w + eps);
    expect(p.y + p.h).toBeLessThanOrEqual(sheet.printable.y + sheet.printable.h + eps);
  }
  for (let i = 0; i < sheet.placements.length; i++) {
    for (let j = i + 1; j < sheet.placements.length; j++) {
      const a = sheet.placements[i];
      const b = sheet.placements[j];
      const overlap = a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
      expect(overlap, `placements ${i} and ${j} overlap`).toBe(false);
    }
  }
}

/** Every photo edge must lie on a cut that runs along the whole edge. */
function expectEdgesCovered(sheet: Sheet) {
  const eps = 1e-4;
  const covered = (axis: 'h' | 'v', pos: number, from: number, to: number) =>
    sheet.cuts.some(c => c.axis === axis && Math.abs(c.pos - pos) < eps && c.from <= from + eps && c.to >= to - eps);
  for (const p of sheet.placements) {
    expect(covered('h', p.y, p.x, p.x + p.w)).toBe(true);
    expect(covered('h', p.y + p.h, p.x, p.x + p.w)).toBe(true);
    expect(covered('v', p.x, p.y, p.y + p.h)).toBe(true);
    expect(covered('v', p.x + p.w, p.y, p.y + p.h)).toBe(true);
  }
}

describe('pack: built-in packages on borderless 4R', () => {
  it.each([
    ['pkg-a', 9],
    ['pkg-b', 12],
    ['pkg-c', 10],
    ['pkg-d', 8]
  ])('%s fits on one sheet with %i photos', (id, count) => {
    const result = packPackage([id], options('4r'));
    expect(result.unplaced).toHaveLength(0);
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].placements).toHaveLength(count);
    expectValidSheet(result.sheets[0]);
    expectEdgesCovered(result.sheets[0]);
  });

  it('Package B fills the 4 × 6 in sheet exactly, 2x2s on top', () => {
    const sheet = packPackage(['pkg-b'], options('4r')).sheets[0];
    expect(sheet.orientation).toBe('portrait');
    const big = sheet.placements.filter(p => p.item.size.key === '2x2');
    const small = sheet.placements.filter(p => p.item.size.key === '1x1');
    expect(Math.max(...big.map(p => p.y + p.h))).toBeCloseTo(101.6);
    expect(Math.min(...small.map(p => p.y))).toBeCloseTo(101.6);
    expect(Math.max(...small.map(p => p.y + p.h))).toBeCloseTo(152.4);
  });

  it('Package D turns the sheet landscape so 8 passports fit', () => {
    const sheet = packPackage(['pkg-d'], options('4r')).sheets[0];
    expect(sheet.orientation).toBe('landscape');
  });

  it('respects a forced orientation and overflows to a second sheet', () => {
    const result = packPackage(['pkg-d'], options('4r', { orientation: 'portrait' }));
    expect(result.sheets).toHaveLength(2);
    expect(result.sheets.reduce((n, s) => n + s.placements.length, 0)).toBe(8);
  });
});

describe('pack: general behaviour', () => {
  it('Package B with a print margin no longer fits one 4R sheet', () => {
    const result = packPackage(['pkg-b'], options('4r', { marginMm: 3 }));
    expect(result.sheets.length).toBeGreaterThan(1);
    result.sheets.forEach(expectValidSheet);
  });

  it('packs several customers onto one A4 sheet', () => {
    const result = packPackage(['pkg-a', 'pkg-b', 'pkg-c'], options('a4'));
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].placements).toHaveLength(31);
    expectValidSheet(result.sheets[0]);
    expectEdgesCovered(result.sheets[0]);
  });

  it('whole-sheet 1x1 fills 4R with 24 photos', () => {
    const result = packPackage(['pkg-full-1x1'], options('4r'));
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].placements).toHaveLength(24);
  });

  it('fill photos use leftover space without adding sheets', () => {
    const people = [
      { personId: 'a', pkg: pkg('pkg-a') },
      { personId: 'b', pkg: pkg('pkg-full-1x1') }
    ];
    const opts = options('4r');
    const result = pack(buildPackItems(people, opts.paperWidthMm * opts.paperHeightMm), opts);
    expect(result.sheets).toHaveLength(1);
    const placements = result.sheets[0].placements;
    expect(placements.filter(p => p.item.personId === 'a')).toHaveLength(9);
    expect(placements.filter(p => p.item.personId === 'b').length).toBeGreaterThan(0);
    expectValidSheet(result.sheets[0]);
  });

  it('keeps gaps between photos when spacing is set', () => {
    const sheet = packPackage(['pkg-b'], options('a4', { gapMm: 2 })).sheets[0];
    expectValidSheet(sheet);
    const xs = [...new Set(sheet.placements.filter(p => p.item.size.key === '2x2').map(p => p.x))].sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeCloseTo(50.8 + 2);
  });

  it('reports photos larger than the printable area', () => {
    const result = packPackage(['pkg-b'], { paperWidthMm: 40, paperHeightMm: 40, marginMm: 0, gapMm: 0, orientation: 'auto' });
    expect(result.unplaced).toHaveLength(4);
    expect(result.sheets.flatMap(s => s.placements)).toHaveLength(8);
  });
});
