// When a crop reaches past the photo's edge, the gap is filled with the
// photo's own backdrop rather than white, so tight close-ups don't come out
// with a white band. ID photos are shot against a plain wall, so the top
// corners are almost always backdrop.

const SAMPLE = 32; // the photo is shrunk to SAMPLE × SAMPLE before sampling
const PATCH = 4; // corner patch size, in sample pixels
const MAX_SPREAD = 20; // per-channel standard deviation a "plain" patch may have
const MAX_CORNER_GAP = 36; // how far apart the two corners' colours may be

const cache = new WeakMap<ImageBitmap, string>();

/** The colour to fill outside the photo with: its backdrop when plain, otherwise white. */
export function backdropColor(bitmap: ImageBitmap): string {
  let color = cache.get(bitmap);
  if (color) return color;
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, SAMPLE, SAMPLE);
  const left = ctx.getImageData(0, 0, PATCH, PATCH).data;
  const right = ctx.getImageData(SAMPLE - PATCH, 0, PATCH, PATCH).data;
  color = plainBackdrop(left, right) ?? '#ffffff';
  cache.set(bitmap, color);
  return color;
}

/** Averages two RGBA corner patches when both are plain and alike; otherwise null. */
export function plainBackdrop(left: Uint8ClampedArray, right: Uint8ClampedArray): string | null {
  const a = patchStats(left);
  const b = patchStats(right);
  if (!a || !b) return null;
  if (Math.max(...a.spread, ...b.spread) > MAX_SPREAD) return null;
  if (Math.max(...a.mean.map((v, i) => Math.abs(v - b.mean[i]))) > MAX_CORNER_GAP) return null;
  const [r, g, bl] = a.mean.map((v, i) => Math.round((v + b.mean[i]) / 2));
  return `rgb(${r}, ${g}, ${bl})`;
}

function patchStats(px: Uint8ClampedArray): { mean: number[]; spread: number[] } | null {
  const n = px.length / 4;
  const sum = [0, 0, 0];
  const sq = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 250) return null; // transparent corner: nothing to match
    for (let c = 0; c < 3; c++) {
      sum[c] += px[i + c];
      sq[c] += px[i + c] * px[i + c];
    }
  }
  const mean = sum.map(s => s / n);
  const spread = sq.map((s, c) => Math.sqrt(Math.max(0, s / n - mean[c] * mean[c])));
  return { mean, spread };
}
