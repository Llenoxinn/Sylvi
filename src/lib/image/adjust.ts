export interface Adjust {
  /** -100 … 100 */
  brightness: number;
  /** -100 … 100 */
  contrast: number;
  /** 0 … 100 */
  sharpen: number;
  /** -100 … 100. Missing on jobs saved before the colour controls, which reads as 0. */
  saturation?: number;
  /** -100 (cooler) … 100 (warmer). Missing reads as 0. */
  warmth?: number;
}

export const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, sharpen: 0, saturation: 0, warmth: 0 };

export const isNeutral = (a: Adjust) => a.brightness === 0 && a.contrast === 0 && a.sharpen === 0 && !a.saturation && !a.warmth;

/**
 * Applies brightness, contrast, saturation, warmth and an unsharp-style sharpen to RGBA pixels in
 * place. Done by hand rather than with `ctx.filter` so results are identical
 * in every browser and in the exported files.
 */
export function applyAdjust(data: Uint8ClampedArray, width: number, height: number, adjust: Adjust): void {
  if (isNeutral(adjust)) return;

  if (adjust.brightness !== 0 || adjust.contrast !== 0) {
    const lut = toneCurve(adjust.brightness, adjust.contrast);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  }

  const saturation = adjust.saturation ?? 0;
  const warmth = adjust.warmth ?? 0;
  if (saturation !== 0 || warmth !== 0) colour(data, 1 + saturation / 100, warmth * 0.25);

  if (adjust.sharpen > 0) sharpen(data, width, height, adjust.sharpen / 100);
}

/** Scales each pixel's distance from its own grey, then nudges red against blue for warmth. */
function colour(data: Uint8ClampedArray, saturation: number, warmth: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const grey = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = grey + (r - grey) * saturation + warmth;
    data[i + 1] = grey + (g - grey) * saturation;
    data[i + 2] = grey + (b - grey) * saturation - warmth;
  }
}

function toneCurve(brightness: number, contrast: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const b = brightness * 1.2;
  const c = contrast * 1.28;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  for (let v = 0; v < 256; v++) lut[v] = factor * (v + b - 128) + 128;
  return lut;
}

function sharpen(data: Uint8ClampedArray, width: number, height: number, amount: number): void {
  const src = new Uint8ClampedArray(data);
  const row = width * 4;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * row + x * 4;
      for (let ch = 0; ch < 3; ch++) {
        const c = src[i + ch];
        const edge = 4 * c - src[i + ch - 4] - src[i + ch + 4] - src[i + ch - row] - src[i + ch + row];
        data[i + ch] = c + edge * amount;
      }
    }
  }
}
