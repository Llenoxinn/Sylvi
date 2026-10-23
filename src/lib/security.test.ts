import { describe, expect, it } from 'vitest';
import { buildPackItems } from './layout/items';
import { pack } from './layout/pack';
import { BUILT_IN_PACKAGES, isPhotoPackage, mergePackages } from './packages';
import { customSize } from './sizes';
import { exportFiles, exportPdf } from './export/export';

describe('layout and package safeguards', () => {
  it('rejects custom dimensions that round to zero, or are non-finite', () => {
    for (const width of [0.001, 0, -1, Infinity, NaN, 10000]) expect(() => customSize(width, 25.4)).toThrow('between');
  });

  it('rejects invalid package quantities and bounded but excessive fill counts before allocating them', () => {
    const pkg = structuredClone(BUILT_IN_PACKAGES[0]);
    pkg.items = [{ size: customSize(1, 1), count: 'fill' }];
    expect(() => buildPackItems([{ personId: 'a', pkg }], 500 * 500)).toThrow('2000 copies');
    pkg.items[0].count = Infinity;
    expect(isPhotoPackage(pkg)).toBe(false);
    expect(() => buildPackItems([{ personId: 'a', pkg }], 15483)).toThrow('invalid');
  });

  it('keeps a remote deletion even if a stale local copy has a newer clock', () => {
    const remote = { ...BUILT_IN_PACKAGES[0], deletedAt: 100, updatedAt: 100 };
    const local = { ...BUILT_IN_PACKAGES[0], updatedAt: 99999 };
    expect(mergePackages([local], [remote])).toEqual({ merged: [remote], toUpload: [] });
    expect(mergePackages([remote], [local]).toUpload).toEqual([remote]);
  });

  it('reports a whole-sheet fill that cannot fit the printable area', () => {
    const pkg = BUILT_IN_PACKAGES.find(p => p.id === 'pkg-full-1x1')!;
    const result = pack(buildPackItems([{ personId: 'a', pkg }], 101.6 * 152.4), { paperWidthMm: 101.6, paperHeightMm: 152.4, marginMm: 40, gapMm: 0, orientation: 'auto' });
    expect(result.sheets).toHaveLength(0);
    expect(result.unplaced.length).toBeGreaterThan(0);
  });

  it('cannot create blank PDF or ZIP output from an empty layout', async () => {
    const job = { sheets: [], people: [], cutStyle: 'marks' as const, calibration: false };
    await expect(exportPdf(job)).rejects.toThrow('no sheets');
    await expect(exportFiles(job, 'png', 'empty')).rejects.toThrow('no sheets');
  });
});
