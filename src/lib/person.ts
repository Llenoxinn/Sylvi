import { applyAdjust, type Adjust } from './image/adjust';
import { autoCrop, cropToRect, type Crop, type FaceBox } from './image/crop';
import type { LoadedPhoto } from './image/load';
import { aspectKey, type PhotoSize } from './sizes';
import { mmToPx } from './units';

export type FaceStatus = 'looking' | 'found' | 'none' | 'failed';

export interface Person {
  id: string;
  name: string;
  photo: LoadedPhoto;
  face: FaceBox | null;
  faceStatus: FaceStatus;
  /** Crops the user adjusted by hand, keyed by aspect ratio. */
  crops: Record<string, Crop>;
  adjust: Adjust;
  packageId: string;
}

export function effectiveCrop(person: Person, size: PhotoSize): Crop {
  const manual = person.crops[aspectKey(size)];
  if (manual) return manual;
  const { width, height } = person.photo;
  return autoCrop(person.face, width, height, size.widthMm / size.heightMm, size.headRatio);
}

/** Draws one photo of `size` for this person at the given resolution. */
export function renderCell(person: Person, size: PhotoSize, dpi: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(mmToPx(size.widthMm, dpi)));
  const h = Math.max(1, Math.round(mmToPx(size.heightMm, dpi)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const { bitmap, width: iw, height: ih } = person.photo;
  const r = cropToRect(effectiveCrop(person, size), iw, ih, size.widthMm / size.heightMm);
  // Clip the source rectangle to the image so browsers draw it consistently;
  // anything outside the photo stays white.
  const sx = Math.max(0, r.sx);
  const sy = Math.max(0, r.sy);
  const ex = Math.min(iw, r.sx + r.sw);
  const ey = Math.min(ih, r.sy + r.sh);
  if (ex > sx && ey > sy) {
    const k = w / r.sw;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, ex - sx, ey - sy, (sx - r.sx) * k, (sy - r.sy) * k, (ex - sx) * k, (ey - sy) * k);
  }

  const { adjust } = person;
  if (adjust.brightness || adjust.contrast || adjust.sharpen) {
    const pixels = ctx.getImageData(0, 0, w, h);
    applyAdjust(pixels.data, w, h, adjust);
    ctx.putImageData(pixels, 0, 0);
  }
  return canvas;
}

/**
 * The lowest print resolution among this person's photo sizes, in DPI.
 * Below ~200 DPI prints start to look soft.
 */
export function printDpi(person: Person, sizes: PhotoSize[]): number {
  let lowest = Infinity;
  for (const size of sizes) {
    const { sh } = cropToRect(effectiveCrop(person, size), person.photo.width, person.photo.height, size.widthMm / size.heightMm);
    lowest = Math.min(lowest, sh / (size.heightMm / 25.4));
  }
  return Math.round(lowest);
}

/** Stable fingerprint of everything that changes how a person's photos look. */
export function personLook(person: Person): string {
  return JSON.stringify([person.photo.width, person.face, person.crops, person.adjust]);
}
