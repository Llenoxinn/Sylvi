import { inToMm } from './units';
import { MAX_PHOTO_MM } from './limits';

/** A printable photo size. `headRatio` is the share of the photo height the
 *  head (chin to crown) should fill when auto-cropping. */
export interface PhotoSize {
  key: string;
  label: string;
  widthMm: number;
  heightMm: number;
  headRatio: number;
}

export const PHOTO_SIZES: PhotoSize[] = [
  { key: '1x1', label: '1x1', widthMm: inToMm(1), heightMm: inToMm(1), headRatio: 0.6 },
  { key: '2x2', label: '2x2', widthMm: inToMm(2), heightMm: inToMm(2), headRatio: 0.6 },
  { key: 'passport', label: 'Passport', widthMm: 35, heightMm: 45, headRatio: 0.74 },
  { key: '1.5x1.5', label: '1.5x1.5', widthMm: inToMm(1.5), heightMm: inToMm(1.5), headRatio: 0.6 },
  { key: '2x2.5', label: '2x2.5', widthMm: inToMm(2), heightMm: inToMm(2.5), headRatio: 0.55 }
];

export function customSize(widthMm: number, heightMm: number, label?: string): PhotoSize {
  const w = round(widthMm);
  const h = round(heightMm);
  if (![w, h].every(v => Number.isFinite(v) && v >= 1 && v <= MAX_PHOTO_MM)) {
    throw new Error(`Photo dimensions must be between 1 and ${MAX_PHOTO_MM} mm.`);
  }
  return { key: `custom-${w}x${h}`, label: label?.trim() || `${w}×${h} mm`, widthMm: w, heightMm: h, headRatio: 0.6 };
}

export function isPhotoSize(value: unknown): value is PhotoSize {
  if (!value || typeof value !== 'object') return false;
  const s = value as PhotoSize;
  return typeof s.key === 'string' && s.key.length > 0 && s.key.length <= 80 &&
    typeof s.label === 'string' && s.label.length > 0 && s.label.length <= 80 &&
    [s.widthMm, s.heightMm].every(v => Number.isFinite(v) && v >= 1 && v <= MAX_PHOTO_MM) &&
    Number.isFinite(s.headRatio) && s.headRatio >= 0.1 && s.headRatio <= 0.95;
}

/** Photos with the same proportions share one crop, so a person's 1x1 and
 *  2x2 copies always match. */
export function aspectKey(size: Pick<PhotoSize, 'widthMm' | 'heightMm'>): string {
  return (size.widthMm / size.heightMm).toFixed(3);
}

const round = (v: number) => Math.round(v * 100) / 100;
