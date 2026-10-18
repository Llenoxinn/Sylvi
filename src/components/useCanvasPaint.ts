import { useLayoutEffect, type RefObject } from 'react';

type Source = HTMLCanvasElement | ImageBitmap;

/**
 * Copies `source` into the canvas at `ref`, sized to `size` (defaults to the
 * source size). The canvas is CPU-backed and repainted if the browser ever
 * resets its context, so previews don't go blank after a GPU hiccup.
 */
export function useCanvasPaint(ref: RefObject<HTMLCanvasElement | null>, source: Source | null | undefined, size?: { width: number; height: number }) {
  const width = size?.width;
  const height = size?.height;

  useLayoutEffect(() => {
    const target = ref.current;
    if (!target || !source) return;
    const paint = () => {
      target.width = width ?? source.width;
      target.height = height ?? source.height;
      const ctx = target.getContext('2d', { willReadFrequently: true });
      ctx?.drawImage(source, 0, 0, target.width, target.height);
    };
    paint();
    target.addEventListener('contextrestored', paint);
    return () => target.removeEventListener('contextrestored', paint);
  }, [ref, source, width, height]);
}
