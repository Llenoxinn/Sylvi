import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const SEEN_KEY = 'sylvi.tour.seen';

/** Whether this browser has already been shown the guide. Storage can be blocked, which counts as seen. */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

// In the order a worker uses them. Each step lights up the first target that's on screen.
const STEPS = [
  {
    targets: ['.board'],
    title: 'Pick the package',
    text: 'Choose what the customer asked for. Each tile shows the prints they take home.'
  },
  {
    targets: ['.sheet-frame'],
    title: 'Add the customer’s photo',
    text: 'Drop it on the sheet, paste it with Ctrl+V or browse your files. Sylvi finds the face and crops it for you.'
  },
  {
    targets: ['.adjust', '.sheet-frame'],
    title: 'Fine-tune a photo',
    text: 'Click any photo on the sheet to open Adjustments: crop, light, color and sharpness. Drag the panel anywhere, or fold it to the edge.'
  },
  {
    targets: ['.dock'],
    title: 'Your tools',
    text: 'Add photos, open recent jobs, edit saved packages and change settings. Hover an icon to see its name. This guide is here too.'
  },
  {
    targets: ['.printbar'],
    title: 'Print or download',
    text: 'Set the paper and cut guides, then print at Actual size (100%) or download a 300 DPI file.'
  }
];

const CARD = { w: 320, h: 196, gap: 14 };

/**
 * A short guided tour of the workspace: each step dims the screen except the
 * part it's about and explains it. Shown once on a first visit, and from the
 * dock whenever someone wants it again.
 */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Blocked storage only means the guide may show again next time.
    }
    setIndex(0);
    onClose();
  };

  // Follow the target as the window resizes or the layout settles.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = step.targets.map(selector => document.querySelector(selector)).find(Boolean);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [open, index, step]);

  useEffect(() => {
    if (open) nextRef.current?.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' && !last) setIndex(i => i + 1);
      else if (e.key === 'ArrowLeft' && index > 0) setIndex(i => i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open || !rect) return null;

  // The card goes below the target, else above, else beside it, else in the middle.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.max(16, Math.min(vw - CARD.w - 16, rect.left));
  const y = Math.max(16, Math.min(vh - CARD.h - 16, rect.top));
  const card: CSSProperties =
    rect.bottom + CARD.gap + CARD.h <= vh - 16
      ? { left: x, top: rect.bottom + CARD.gap }
      : rect.top - CARD.gap - CARD.h >= 16
        ? { left: x, top: rect.top - CARD.gap - CARD.h }
        : rect.right + CARD.gap + CARD.w <= vw - 16
          ? { left: rect.right + CARD.gap, top: y }
          : rect.left - CARD.gap - CARD.w >= 16
            ? { left: rect.left - CARD.gap - CARD.w, top: y }
            : { left: (vw - CARD.w) / 2, top: (vh - CARD.h) / 2 };

  // The frame stays inside the window, so a full-width target still shows all four crop marks.
  const spotLeft = Math.max(14, rect.left - 6);
  const spotTop = Math.max(14, rect.top - 6);
  const spot: CSSProperties = {
    left: spotLeft,
    top: spotTop,
    width: Math.min(vw - 14, rect.right + 6) - spotLeft,
    height: Math.min(vh - 14, rect.bottom + 6) - spotTop
  };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* The lit area, framed by crop marks like the Sylvi logo, as if marked for cutting. */}
      <span className="tour-spot" style={spot} aria-hidden="true">
        <span className="tour-mark tour-mark--tl" />
        <span className="tour-mark tour-mark--tr" />
        <span className="tour-mark tour-mark--bl" />
        <span className="tour-mark tour-mark--br" />
      </span>
      <div className="tour-card" style={{ ...card, width: CARD.w }}>
        <div className="tour-progress" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} data-done={i <= index ? '' : undefined} />
          ))}
        </div>
        <p className="tour-count">
          Step {index + 1} of {STEPS.length}
        </p>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        <p className="tour-text">{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={finish}>
            Skip
          </button>
          <span className="tour-spacer" />
          {index > 0 ? (
            <button type="button" className="btn btn--sm" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          ) : null}
          <button ref={nextRef} type="button" className="btn btn--sm btn--primary" onClick={() => (last ? finish() : setIndex(index + 1))}>
            {last ? 'Start working' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
