/** Face bounding box as fractions of the image size. */
export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A crop window, stored relative to the image so it survives resizing:
 * `cx`/`cy` are the window centre as fractions of the image width/height and
 * `h` is the window height as a fraction of the image height. The width
 * follows from the photo size's aspect ratio.
 */
export interface Crop {
  cx: number;
  cy: number;
  h: number;
}

// The detector's box runs roughly from the brows to the chin; a full head
// (crown to chin) is about this much taller.
const HEAD_PER_FACE = 1.6;
const CROWN_ABOVE_FACE = 0.5;

/** Frames the head so it fills `headRatio` of the photo height, with headroom above. */
export function autoCrop(face: FaceBox | null, imgW: number, imgH: number, aspect: number, headRatio: number): Crop {
  if (!face) return centerCrop(imgW, imgH, aspect);

  const faceHpx = face.h * imgH;
  const headHpx = faceHpx * HEAD_PER_FACE;
  const idealHpx = headHpx / headRatio;
  const crownPx = face.y * imgH - faceHpx * CROWN_ABOVE_FACE;
  const headroomPx = idealHpx * (1 - headRatio) * 0.38;
  const idealTopPx = crownPx - headroomPx;

  // Prefer framing inside the photo: zoom in a little rather than pad with
  // white, but never so much that the head gets cut off. Close-ups that still
  // don't fit keep a thin white edge, which the crop editor can fix.
  const maxHpx = Math.min(imgH, imgW / aspect);
  const hPx = Math.max(Math.min(idealHpx, maxHpx), idealHpx * MAX_AUTO_ZOOM);
  const headCenterPx = crownPx + headHpx / 2;
  const headAt = (headCenterPx - idealTopPx) / idealHpx;
  const wPx = hPx * aspect;
  const cxPx = fitWithin((face.x + face.w / 2) * imgW, wPx, imgW);
  // Keeping the window inside the photo must never push it below the crown.
  const crownLimit = crownPx - hPx * 0.04 + hPx / 2;
  const cyPx = Math.min(fitWithin(headCenterPx - headAt * hPx + hPx / 2, hPx, imgH), crownLimit);

  return { cx: cxPx / imgW, cy: cyPx / imgH, h: hPx / imgH };
}

/** How much tighter than ideal the automatic crop may go to avoid white edges. */
const MAX_AUTO_ZOOM = 0.85;

/** Moves a window centre so the window stays inside [0, total], when it can fit at all. */
function fitWithin(center: number, size: number, total: number): number {
  if (size >= total) return center; // too big either way: keep it on the head
  return Math.min(total - size / 2, Math.max(size / 2, center));
}

/** The largest window of this aspect that fits inside the image, centred. */
export function centerCrop(imgW: number, imgH: number, aspect: number): Crop {
  const hPx = Math.min(imgH, imgW / aspect);
  return { cx: 0.5, cy: 0.5, h: hPx / imgH };
}

/** Keeps the window centre on the image and the zoom within sensible limits. */
export function clampCrop(crop: Crop, imgW: number, imgH: number, aspect: number): Crop {
  const maxH = Math.max(imgH, imgW / aspect) * 1.5;
  const minH = 24;
  const hPx = Math.min(maxH, Math.max(minH, crop.h * imgH));
  return {
    cx: clamp01(crop.cx),
    cy: clamp01(crop.cy),
    h: hPx / imgH
  };
}

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Converts a crop to a pixel rectangle on the source image (may extend past its edges). */
export function cropToRect(crop: Crop, imgW: number, imgH: number, aspect: number): SourceRect {
  const sh = crop.h * imgH;
  const sw = sh * aspect;
  return { sx: crop.cx * imgW - sw / 2, sy: crop.cy * imgH - sh / 2, sw, sh };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
