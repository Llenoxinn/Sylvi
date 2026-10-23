import { MAX_FILE_BYTES, MAX_INPUT_PIXELS } from '../limits';
import { imageDimensions } from './dimensions';

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
  if (file.size > MAX_FILE_BYTES) throw new PhotoError('This photo exceeds 25 MB. Save a smaller JPG, PNG or WebP first.');
  const dimensions = imageDimensions(new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer()));
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new PhotoError('This file isn’t a supported JPG, PNG or WebP photo, or its image header is damaged.');
  }
  if (dimensions.width * dimensions.height > MAX_INPUT_PIXELS) {
    throw new PhotoError('This photo exceeds 40 megapixels. Resize it before adding it.');
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(dimensions.width, dimensions.height));
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
  } catch {
    throw new PhotoError(`“${name || 'This photo'}” couldn’t be read. It may be damaged or in an unsupported format.`);
  }

  if (!bitmap.width || !bitmap.height || Math.max(bitmap.width, bitmap.height) > MAX_EDGE) {
    bitmap.close();
    throw new PhotoError('The browser couldn’t resize this photo safely. Save a smaller copy first.');
  }
  if (scale === 1) return { bitmap, blob: file, width: bitmap.width, height: bitmap.height };

  // Keep a smaller copy for Recent jobs.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new PhotoError('The photo couldn’t be resized.'))), 'image/jpeg', 0.92)
    );
    return { bitmap, blob, width: bitmap.width, height: bitmap.height };
  } catch (error) {
    bitmap.close();
    throw error;
  }
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
