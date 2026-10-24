import { useEffect, useId, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronsRight, Crop, GripVertical, LoaderCircle, RotateCcw, ScanFace, SlidersHorizontal, Trash2, TriangleAlert, X } from 'lucide-react';
import { isNeutral } from '../lib/image/adjust';
import { printDpi, type Person } from '../lib/person';
import { findPackage, useStore } from '../state/store';
import { Slider } from './ui';

export type PanelState = 'open' | 'collapsed' | 'closed';

/**
 * A floating adjustments panel, like the tool panels in a photo editor. It
 * rests at the right of the mat, drags anywhere by its title bar, folds into a
 * slim tab that peeks open on hover, and closes until a photo is clicked.
 */
export function AdjustPanel({
  person,
  state,
  onState,
  position,
  onMove,
  bounds
}: {
  person: Person;
  state: Exclude<PanelState, 'closed'>;
  onState: (state: PanelState) => void;
  /** Top-left inside the mat once dragged; null rests it at the right edge. */
  position: { x: number; y: number } | null;
  onMove: (position: { x: number; y: number }) => void;
  bounds: { w: number; h: number };
}) {
  const rename = useStore(s => s.renamePerson);
  const setAdjust = useStore(s => s.setAdjust);
  const resetAdjust = useStore(s => s.resetAdjust);
  const removePerson = useStore(s => s.removePerson);
  const openCropEditor = useStore(s => s.openCropEditor);
  const custom = useStore(s => s.customPackages);
  const panelRef = useRef<HTMLElement>(null);
  const nameId = useId();
  const titleId = useId();

  // Escape folds it away rather than closing, so it's one click to get back.
  useEffect(() => {
    if (state !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof Element && e.target.closest('dialog'))) onState('collapsed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, onState]);

  // Drag by the title bar, kept inside the mat.
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    const panel = panelRef.current;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent) return;
    const start = { x: e.clientX, y: e.clientY, left: panel.offsetLeft, top: panel.offsetTop };
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const x = Math.max(8, Math.min(bounds.w - panel.offsetWidth - 8, start.left + ev.clientX - start.x));
      const y = Math.max(8, Math.min(bounds.h - 48, start.top + ev.clientY - start.y));
      onMove({ x, y });
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const status = {
    looking: { icon: <LoaderCircle size={14} className="spin" />, text: 'Finding the face…' },
    found: { icon: <ScanFace size={14} />, text: 'Face found and cropped automatically.' },
    none: { icon: <ScanFace size={14} />, text: 'No face found, so the photo is centered. Adjust the crop to frame it.' },
    failed: { icon: <ScanFace size={14} />, text: 'Face detection isn’t available offline yet, so the photo is centered.' }
  }[person.faceStatus];
  const dpi = printDpi(person, findPackage(custom, person.packageId, person.packageSnapshot).items.map(i => i.size));
  const { adjust } = person;

  const placed: CSSProperties = position && state === 'open' ? { left: position.x, top: position.y } : {};

  return (
    <section
      ref={panelRef}
      className="adjust"
      data-state={state}
      data-placed={position && state === 'open' ? '' : undefined}
      style={placed}
      aria-labelledby={titleId}
    >
      <div className="adjust-bar" onPointerDown={state === 'open' ? startDrag : undefined}>
        {state === 'open' ? <GripVertical size={14} className="adjust-grip" aria-hidden="true" /> : null}
        <button
          type="button"
          className="adjust-tab"
          onClick={() => onState(state === 'open' ? 'collapsed' : 'open')}
          aria-expanded={state === 'open'}
          aria-label={state === 'open' ? 'Fold the adjustments panel' : 'Open the adjustments panel'}
        >
          {state === 'open' ? <ChevronsRight size={15} /> : <SlidersHorizontal size={16} />}
        </button>
        <h2 id={titleId} className="adjust-title">
          Adjustments
        </h2>
        <button type="button" className="adjust-close" onClick={() => onState('closed')} aria-label="Close the adjustments panel">
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>

      <div className="adjust-body">
        <div className="field">
          <label className="field-label" htmlFor={nameId}>
            Customer
          </label>
          <input id={nameId} className="input" value={person.name} maxLength={40} onChange={e => rename(person.id, e.target.value)} />
        </div>

        <div className="adjust-group">
          <h3 className="adjust-group-title">Crop</h3>
          <p className={`face-status face-status--${person.faceStatus}`} aria-live="polite">
            {status.icon}
            {status.text}
          </p>
          {dpi < 200 ? (
            <p className="face-status face-status--none" role="note">
              <TriangleAlert size={14} />
              Small photo ({person.photo.width} × {person.photo.height} px): about {dpi} DPI, so prints may look soft. Ask for a bigger one if you can.
            </p>
          ) : null}
          <button type="button" className="btn btn--sm btn--block" onClick={() => openCropEditor(person.id)}>
            <Crop size={14} />
            Adjust crop
          </button>
        </div>

        <div className="adjust-group">
          <h3 className="adjust-group-title">Light</h3>
          <Slider label="Brightness" value={adjust.brightness} min={-100} max={100} onChange={v => setAdjust(person.id, { brightness: v })} />
          <Slider label="Contrast" value={adjust.contrast} min={-100} max={100} onChange={v => setAdjust(person.id, { contrast: v })} />
        </div>

        <div className="adjust-group">
          <h3 className="adjust-group-title">Color</h3>
          <Slider label="Saturation" value={adjust.saturation ?? 0} min={-100} max={100} onChange={v => setAdjust(person.id, { saturation: v })} />
          <Slider label="Warmth" value={adjust.warmth ?? 0} min={-100} max={100} onChange={v => setAdjust(person.id, { warmth: v })} />
        </div>

        <div className="adjust-group">
          <h3 className="adjust-group-title">Detail</h3>
          <Slider label="Sharpness" value={adjust.sharpen} min={0} max={100} format={String} onChange={v => setAdjust(person.id, { sharpen: v })} />
        </div>

        <div className="row row--split">
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => resetAdjust(person.id)} disabled={isNeutral(adjust)}>
            <RotateCcw size={14} />
            Reset
          </button>
          <button type="button" className="btn btn--sm btn--ghost btn--danger" onClick={() => removePerson(person.id)}>
            <Trash2 size={14} />
            Remove photo
          </button>
        </div>
      </div>
    </section>
  );
}
