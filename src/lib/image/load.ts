export interface LoadedPhoto {
  bitmap: ImageBitmap;
  /** The (possibly downscaled) image, kept so a recent job can be reopened. */
  blob: Blob;
  width: number;
  height: number;
}

// Big enough for a 2x2 at 300 DPI from a loosely framed photo, small enough
// to keep memory in check when a shop loads several customers at once.
const MAX_EDGE = 3200;

export class PhotoError extends Error {}

export async function loadPhoto(file: Blob, name = ''): Promise<LoadedPhoto> {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(name)) {
    throw new PhotoError('HEIC photos from iPhones can’t be opened in this browser. Send or save the photo as JPG, then add it again.');
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new PhotoError(`“${name || 'This file'}” isn’t an image. Add a JPG, PNG or WebP photo.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError(`“${name || 'This photo'}” couldn’t be read. It may be damaged or in an unsupported format.`);
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_EDGE) return { bitmap, blob: file, width: bitmap.width, height: bitmap.height };

  // Resize while decoding rather than through a canvas: a canvas-made bitmap
  // can live on the GPU and comes back blank if the GPU context is reset
  // (which loading the face model can trigger).
  const scale = MAX_EDGE / longest;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  bitmap.close();
  const resized = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });

  // Keep a smaller copy for Recent jobs.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(resized, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new PhotoError('The photo couldn’t be resized.'))), 'image/jpeg', 0.92)
  );
  return { bitmap: resized, blob, width, height };
}

/** Pulls image files out of a paste or drop. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (files.length) return files;
  return Array.from(data.items ?? [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter((f): f is File => !!f);
}
