import { describe, expect, it } from 'vitest';
import { applyAdjust, NO_ADJUST } from './image/adjust';
import { autoCrop, centerCrop, cropToRect } from './image/crop';
import { crc32, setJpegDpi, setPngDpi } from './export/dpi';
import { buildGuides, placeCalibration } from './layout/guides';
import { pack } from './layout/pack';
import { buildPackItems } from './layout/items';
import { BUILT_IN_PACKAGES } from './packages';

describe('crop', () => {
  it('center crop is the largest window of the aspect inside the image', () => {
    const crop = centerCrop(4000, 3000, 1);
    expect(cropToRect(crop, 4000, 3000, 1)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 });
  });

  it('auto crop makes the head fill the requested share of the height', () => {
    const face = { x: 0.4, y: 0.3, w: 0.2, h: 0.2 };
    const crop = autoCrop(face, 1000, 1000, 1, 0.6);
    const rect = cropToRect(crop, 1000, 1000, 1);
    const head = 200 * 1.6;
    expect(head / rect.sh).toBeCloseTo(0.6, 5);
    expect(rect.sx + rect.sw / 2).toBeCloseTo(500);
    // The crown sits below the top edge of the photo.
    const crown = 300 - 200 * 0.5;
    expect(crown).toBeGreaterThan(rect.sy);
  });

  it('auto crop stays inside the photo instead of padding with white', () => {
    // A narrow portrait with a small face near the left edge.
    const face = { x: 0.05, y: 0.2, w: 0.25, h: 0.12 };
    const rect = cropToRect(autoCrop(face, 2000, 3000, 1, 0.6), 2000, 3000, 1);
    expect(rect.sx).toBeGreaterThanOrEqual(-1e-6);
    expect(rect.sy).toBeGreaterThanOrEqual(-1e-6);
    expect(rect.sx + rect.sw).toBeLessThanOrEqual(2000 + 1e-6);
    expect(rect.sy + rect.sh).toBeLessThanOrEqual(3000 + 1e-6);
  });

  it('never cuts off the head on a close-up, even if that leaves a white edge', () => {
    // Face fills much of a narrow photo, so the ideal 2x2 frame is wider than the image.
    const face = { x: 0.2, y: 0.18, w: 0.6, h: 0.3 };
    const crop = autoCrop(face, 2000, 3000, 1, 0.6);
    const rect = cropToRect(crop, 2000, 3000, 1);
    const crown = 0.18 * 3000 - 0.3 * 3000 * 0.5;
    const chin = 0.48 * 3000;
    expect(rect.sy).toBeLessThan(crown);
    expect(rect.sy + rect.sh).toBeGreaterThan(chin);
  });
});

describe('adjust', () => {
  it('leaves pixels untouched when neutral', () => {
    const px = new Uint8ClampedArray([10, 20, 30, 255]);
    applyAdjust(px, 1, 1, NO_ADJUST);
    expect([...px]).toEqual([10, 20, 30, 255]);
  });

  it('brightens and keeps alpha', () => {
    const px = new Uint8ClampedArray([100, 100, 100, 200]);
    applyAdjust(px, 1, 1, { brightness: 50, contrast: 0, sharpen: 0 });
    expect(px[0]).toBeGreaterThan(100);
    expect(px[3]).toBe(200);
  });
});

describe('dpi metadata', () => {
  it('crc32 matches the known value for "IEND"', () => {
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082);
  });

  it('writes a pHYs chunk after IHDR', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89,
      0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ]);
    const out = setPngDpi(png, 300);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs');
    const view = new DataView(out.buffer);
    expect(view.getUint32(41)).toBe(11811);
    expect(out.length).toBe(png.length + 21);
    expect(setPngDpi(out, 300).length).toBe(out.length);
  });

  it('sets JFIF density to 300 dpi', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const out = setJpegDpi(jpeg, 300);
    expect([out[13], (out[14] << 8) | out[15], (out[16] << 8) | out[17]]).toEqual([1, 300, 300]);
  });
});

describe('guides', () => {
  const sheetFor = (pkgId: string, w: number, h: number, margin: number) => {
    const pkg = BUILT_IN_PACKAGES.find(p => p.id === pkgId)!;
    return pack(buildPackItems([{ personId: 'a', pkg }], w * h), {
      paperWidthMm: w,
      paperHeightMm: h,
      marginMm: margin,
      gapMm: 0,
      orientation: 'portrait'
    }).sheets[0];
  };

  it('puts crop marks outside the photos when there is margin', () => {
    const sheet = sheetFor('pkg-b', 210, 297, 6.35);
    const guides = buildGuides(sheet, 'marks');
    expect(guides.segments.length).toBeGreaterThan(0);
    const inside = (x: number, y: number) =>
      sheet.placements.some(p => x > p.x + 0.01 && x < p.x + p.w - 0.01 && y > p.y + 0.01 && y < p.y + p.h - 0.01);
    for (const s of guides.segments) {
      expect(inside((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2)).toBe(false);
    }
  });

  it('draws one line per cut for the lines style', () => {
    const sheet = sheetFor('pkg-b', 101.6, 152.4, 0);
    expect(buildGuides(sheet, 'lines').segments).toHaveLength(sheet.cuts.length);
    expect(buildGuides(sheet, 'spaced').segments).toHaveLength(0);
  });

  it('only places the 1-inch check when there is room', () => {
    expect(placeCalibration(sheetFor('pkg-b', 101.6, 152.4, 0))).toBeNull();
    expect(placeCalibration(sheetFor('pkg-b', 210, 297, 6.35))).not.toBeNull();
  });
});
