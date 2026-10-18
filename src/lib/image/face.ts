import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { FaceBox } from './crop';

let detector: Promise<FaceDetector> | null = null;

/** Loads the face model on first use; later calls reuse it. */
function getDetector(): Promise<FaceDetector> {
  detector ??= (async () => {
    const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
    const base = import.meta.env.BASE_URL;
    const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe`);
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base}models/blaze_face_short_range.tflite`, delegate: 'CPU' },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5
    });
  })();
  detector.catch(() => {
    detector = null; // allow a retry, e.g. after coming back online
  });
  return detector;
}

const DETECT_EDGE = 640;

/** Finds the largest face, as fractions of the image size, or null if none. */
export async function detectFace(bitmap: ImageBitmap): Promise<FaceBox | null> {
  const faceDetector = await getDetector();

  const scale = Math.min(1, DETECT_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const { detections } = faceDetector.detect(canvas);
  let best: FaceBox | null = null;
  for (const d of detections) {
    const box = d.boundingBox;
    if (!box) continue;
    const face = { x: box.originX / canvas.width, y: box.originY / canvas.height, w: box.width / canvas.width, h: box.height / canvas.height };
    if (!best || face.w * face.h > best.w * best.h) best = face;
  }
  return best;
}
