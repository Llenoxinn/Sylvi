import { useEffect, useMemo, useRef, useState } from 'react';
import { clampCrop, cropToRect, type Crop } from '../lib/image/crop';
import { effectiveCrop } from '../lib/person';
import { aspectKey, type PhotoSize } from '../lib/sizes';
import { findPackage, useStore } from '../state/store';
import { Dialog, Segmented, Slider } from './ui';
import { useCanvasPaint } from './useCanvasPaint';

const FRAME_H = 340;

/** Drag to move, scroll or use the slider to zoom. Shared by every size with the same shape. */
export function CropEditor() {
  const id = useStore(s => s.cropEditorFor);
  const person = useStore(s => s.people.find(p => p.id === s.cropEditorFor) ?? null);
  const custom = useStore(s => s.customPackages);
  const setCrop = useStore(s => s.setCrop);
  const close = () => useStore.getState().openCropEditor(null);

  // One tab per distinct photo shape in this person's package.
  const shapes = useMemo(() => {
    if (!person) return [] as PhotoSize[];
    const seen = new Map<string, PhotoSize>();
    for (const item of findPackage(custom, person.packageId, person.packageSnapshot).items) {
      const key = aspectKey(item.size);
      if (!seen.has(key)) seen.set(key, item.size);
    }
    return [...seen.values()];
  }, [person?.packageId, custom, person]);

  const [shapeKey, setShapeKey] = useState<string>('');
  const size = shapes.find(s => aspectKey(s) === shapeKey) ?? shapes[0];

  useEffect(() => {
    if (id) setShapeKey('');
  }, [id]);

  return (
    <Dialog
      open={!!person && !!size}
      title={person ? `Adjust crop for ${person.name}` : 'Adjust crop'}
      onClose={close}
      wide
      footer={
        person && size ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCrop(person.id, aspectKey(size), null)} disabled={!person.crops[aspectKey(size)]}>
              Use automatic crop
            </button>
            <button type="button" className="btn btn--primary" onClick={close}>
              Done
            </button>
          </>
        ) : null
      }
    >
      {person && size ? (
        <>
          {shapes.length > 1 ? (
            <Segmented
              label="Photo shape"
              value={aspectKey(size)}
              options={shapes.map(s => ({ id: aspectKey(s), label: shapeLabel(s, shapes) }))}
              onChange={setShapeKey}
            />
          ) : null}
          <CropFrame
            key={`${person.id}|${aspectKey(size)}`}
            size={size}
            image={person.photo}
            crop={effectiveCrop(person, size)}
            onChange={crop => setCrop(person.id, aspectKey(size), crop)}
          />
          <p className="hint">
            Drag the photo to move it and scroll to zoom. Line up the head with the oval, chin near its bottom. Every {sizesFor(size, findPackage(custom, person.packageId, person.packageSnapshot).items.map(i => i.size))} photo uses this crop.
          </p>
        </>
      ) : null}
    </Dialog>
  );
}

function shapeLabel(size: PhotoSize, shapes: PhotoSize[]): string {
  const ratio = size.widthMm / size.heightMm;
  if (Math.abs(ratio - 1) < 0.01) return 'Square';
  return shapes.length > 1 ? size.label : 'Photo';
}

function sizesFor(size: PhotoSize, all: PhotoSize[]): string {
  const key = aspectKey(size);
  const labels = [...new Set(all.filter(s => aspectKey(s) === key).map(s => s.label))];
  return labels.join(' and ');
}

function CropFrame({
  size,
  image,
  crop,
  onChange
}: {
  size: PhotoSize;
  image: { bitmap: ImageBitmap; width: number; height: number };
  crop: Crop;
  onChange: (crop: Crop) => void;
}) {
  const aspect = size.widthMm / size.heightMm;
  const frameH = FRAME_H;
  const frameW = frameH * aspect;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; start: Crop } | null>(null);
  const live = useRef(crop);
  live.current = crop;

  const rect = cropToRect(crop, image.width, image.height, aspect);
  const s = frameH / rect.sh; // screen px per image px

  // Draw the photo once into a canvas; moving it is just a CSS transform.
  const k = Math.min(1, 1600 / Math.max(image.width, image.height));
  useCanvasPaint(canvasRef, image.bitmap, { width: Math.round(image.width * k), height: Math.round(image.height * k) });

  const commit = (next: Crop) => onChange(clampCrop(next, image.width, image.height, aspect));

  const zoomBy = (factor: number) => commit({ ...live.current, h: live.current.h * factor });

  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // Zoom slider: 0 = whole photo fits, 100 = tight.
  const fitH = Math.max(1, image.width / aspect / image.height, 1);
  const zoom = Math.round(Math.max(0, Math.min(100, (Math.log(fitH / crop.h) / Math.log(fitH / 0.08)) * 100)));

  return (
    <div className="crop">
      <div
        ref={stageRef}
        className="crop-stage"
        tabIndex={0}
        role="application"
        aria-label="Crop area. Use the arrow keys to move the photo and plus or minus to zoom."
        style={{ height: frameH + 48 }}
        onPointerDown={e => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, start: live.current };
        }}
        onPointerMove={e => {
          const d = drag.current;
          if (!d) return;
          const dx = (e.clientX - d.x) / s;
          const dy = (e.clientY - d.y) / s;
          commit({ ...d.start, cx: d.start.cx - dx / image.width, cy: d.start.cy - dy / image.height });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={e => {
          const step = (e.shiftKey ? 20 : 4) / s;
          const c = live.current;
          const moves: Record<string, Partial<Crop>> = {
            ArrowLeft: { cx: c.cx + step / image.width },
            ArrowRight: { cx: c.cx - step / image.width },
            ArrowUp: { cy: c.cy + step / image.height },
            ArrowDown: { cy: c.cy - step / image.height }
          };
          if (moves[e.key]) {
            e.preventDefault();
            commit({ ...c, ...moves[e.key] });
          } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoomBy(0.95);
          } else if (e.key === '-') {
            e.preventDefault();
            zoomBy(1.05);
          }
        }}
      >
        <div className="crop-center" style={{ width: frameW, height: frameH }}>
          <canvas
            ref={canvasRef}
            className="crop-image"
            style={{
              width: image.width * s,
              height: image.height * s,
              transform: `translate(${-rect.sx * s}px, ${-rect.sy * s}px)`
            }}
          />
          <div className="crop-window" aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <ellipse
                cx="50"
                cy={50 - (1 - size.headRatio) * 12}
                rx={(size.headRatio * 50 * 0.74) / aspect}
                ry={size.headRatio * 50}
              />
              <line x1="50" y1="0" x2="50" y2="100" />
            </svg>
          </div>
        </div>
      </div>
      <Slider label="Zoom" value={zoom} min={0} max={100} format={v => `${v}%`} onChange={v => {
        const h = fitH / Math.pow(fitH / 0.08, v / 100);
        commit({ ...live.current, h });
      }} />
    </div>
  );
}
