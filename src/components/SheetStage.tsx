import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, TriangleAlert } from 'lucide-react';
import { buildGuides, calibrationLabel, placeCalibration } from '../lib/layout/guides';
import type { Placement, Sheet } from '../lib/layout/pack';
import { personLook, renderCell, type Person } from '../lib/person';
import { resolvePaper } from '../lib/papers';
import type { PhotoSize } from '../lib/sizes';
import { formatSize, MM_PER_INCH } from '../lib/units';
import { useStore } from '../state/store';
import { SAMPLE_PERSON, useLayout } from '../state/useLayout';
import { PeopleStrip } from './PeopleStrip';
import { AdjustPanel, type PanelState } from './AdjustPanel';
import { Rulers } from './Rulers';
import { useCanvasPaint } from './useCanvasPaint';

const PAD = { top: 84, right: 40, bottom: 104, left: 52 };
const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

export function SheetStage({ onBrowse }: { onBrowse: () => void }) {
  const layout = useLayout();
  const people = useStore(s => s.people);
  const activeId = useStore(s => s.activeId);
  const settings = useStore(s => s.settings);
  const setActive = useStore(s => s.setActive);
  const openCropEditor = useStore(s => s.openCropEditor);

  const stageRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<PanelState>('open');
  const [panelAt, setPanelAt] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sheetIndex = Math.min(page, Math.max(0, layout.sheets.length - 1));
  const sheet = layout.sheets[sheetIndex];
  const paper = resolvePaper(settings.paper);
  const fallbackW = paper.widthMm;
  const fallbackH = paper.heightMm;
  const sheetW = sheet?.widthMm ?? fallbackW;
  const sheetH = sheet?.heightMm ?? fallbackH;

  const scale = Math.max(
    0.5,
    Math.min((box.w - PAD.left - PAD.right) / sheetW, (box.h - PAD.top - PAD.bottom) / sheetH)
  );
  const pxW = sheetW * scale;
  const pxH = sheetH * scale;
  const left = PAD.left + (box.w - PAD.left - PAD.right - pxW) / 2;
  const top = PAD.top + (box.h - PAD.top - PAD.bottom - pxH) / 2;

  // Screen resolution for the cells, in steps so resizing doesn't re-render constantly.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const dpi = Math.min(300, Math.max(72, Math.ceil((scale * MM_PER_INCH * dpr) / 25) * 25));
  const cells = useCellCanvases(people, layout.sheets, dpi);

  const gridMm = settings.unit === 'in' ? MM_PER_INCH : 10;
  const gridPx = gridMm * scale;
  const unplaced = layout.unplaced.length;
  const total = layout.sheets.reduce((n, s) => n + s.placements.length, 0);

  // The adjustments panel follows the selected customer and stays where it was put.
  const selected = people.find(p => p.id === activeId) ?? null;
  const showPanel = selected !== null && panel !== 'closed';
  const openTools = (personId: string) => {
    if (personId === SAMPLE_PERSON) return;
    setActive(personId);
    setPanel(state => (state === 'closed' ? 'open' : state));
  };

  return (
    <section
      ref={stageRef}
      className="stage"
      aria-label="Print sheet preview"
      style={
        {
          '--grid': `${gridPx}px`,
          '--grid-x': `${left % gridPx}px`,
          '--grid-y': `${top % gridPx}px`
        } as React.CSSProperties
      }
    >
      <PeopleStrip onBrowse={onBrowse} onOpen={openTools} />

      {layout.sheets.length > 1 ? (
        <div className="pager" role="group" aria-label="Sheets">
          <button type="button" className="pager-btn" onClick={() => setPage(sheetIndex - 1)} disabled={sheetIndex === 0} aria-label="Previous sheet">
            <ChevronLeft size={16} />
          </button>
          <span aria-live="polite">
            Sheet {sheetIndex + 1} of {layout.sheets.length}
          </span>
          <button
            type="button"
            className="pager-btn"
            onClick={() => setPage(sheetIndex + 1)}
            disabled={sheetIndex === layout.sheets.length - 1}
            aria-label="Next sheet"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}

      {box.w > 0 && sheet ? (
        <div className="sheet-frame" style={{ left, top, width: pxW, height: pxH }}>
          <Rulers widthMm={sheetW} heightMm={sheetH} scale={scale} unit={settings.unit} />
          <div className={`sheet${layout.sample ? ' sheet--sample' : ''}`}>
            {sheet.placements.map(p => (
              <SheetCell
                key={p.item.id}
                placement={p}
                scale={scale}
                person={people.find(person => person.id === p.item.personId)}
                canvas={cells.get(cellKey(p.item.personId, p.item.size))}
                active={(showPanel && p.item.personId === activeId) || (people.length > 1 && p.item.personId === activeId)}
                onSelect={() => openTools(p.item.personId)}
                onOpen={() => p.item.personId !== SAMPLE_PERSON && openCropEditor(p.item.personId)}
              />
            ))}
            <GuidesOverlay sheet={sheet} scale={scale} />
          </div>
          <p className="sheet-caption">
            {paper.label}, {formatSize(sheetW, sheetH, settings.unit)}
            {settings.paper.marginMm === 0 ? ', borderless' : ''}
            {layout.sample ? '' : `. ${total} photo${total === 1 ? '' : 's'} on ${layout.sheets.length} sheet${layout.sheets.length === 1 ? '' : 's'}`}
          </p>
        </div>
      ) : null}

      {layout.sample && box.w > 0 ? (
        // The sample sheet is the drop target: crop-mark corners frame it, and a
        // click anywhere on it browses. The button keeps it reachable by keyboard.
        <div className="sheet-drop" style={{ left, top, width: pxW, height: pxH }} onClick={onBrowse}>
          <span className="sheet-drop-corners" aria-hidden="true" />
          <div className="sheet-drop-prompt" onClick={e => e.stopPropagation()}>
            <h2>Drop a photo on the sheet</h2>
            <button type="button" className="btn btn--primary" onClick={onBrowse}>
              <ImagePlus size={16} aria-hidden="true" />
              Browse files
            </button>
            <p className="sheet-drop-keys">
              or paste <kbd>{MOD_KEY}</kbd>
              <kbd>V</kbd>
            </p>
          </div>
        </div>
      ) : null}

      {showPanel && selected && box.w > 0 ? (
        <AdjustPanel person={selected} state={panel === 'collapsed' ? 'collapsed' : 'open'} onState={setPanel} position={panelAt} onMove={setPanelAt} bounds={box} />
      ) : null}

      {layout.error || unplaced > 0 ? (
        <div className="stage-alert" role="alert">
          <TriangleAlert size={16} />
          <p>
            {layout.error ?? `${unplaced} photo${unplaced === 1 ? ' is' : 's are'} bigger than the printable area of ${paper.label}. Choose bigger paper or a smaller margin.`}
          </p>
        </div>
      ) : null}
    </section>
  );
}

const cellKey = (personId: string, size: PhotoSize) => `${personId}|${size.key}|${size.widthMm}x${size.heightMm}`;

/** Renders each person × size once per look and resolution, reusing canvases between renders. */
function useCellCanvases(people: Person[], sheets: Sheet[], dpi: number) {
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const looks = people.map(personLook).join('§');
  const sizes = sheets
    .flatMap(s => s.placements.map(p => cellKey(p.item.personId, p.item.size)))
    .filter((k, i, all) => all.indexOf(k) === i)
    .join(',');

  return useMemo(() => {
    const next = new Map<string, HTMLCanvasElement>();
    const fresh = new Map<string, HTMLCanvasElement>();
    const seen = new Set<string>();
    for (const sheet of sheets) {
      for (const p of sheet.placements) {
        const key = cellKey(p.item.personId, p.item.size);
        if (seen.has(key)) continue;
        seen.add(key);
        const person = people.find(x => x.id === p.item.personId);
        if (!person) continue;
        const versioned = `${key}|${personLook(person)}|${dpi}`;
        const canvas = cache.current.get(versioned) ?? renderCell(person, p.item.size, dpi);
        fresh.set(versioned, canvas);
        next.set(key, canvas);
      }
    }
    cache.current = fresh;
    return next;
    // `looks` and `sizes` capture everything about people/sheets that changes the pixels.
  }, [looks, sizes, dpi]);
}

function SheetCell({
  placement: p,
  scale,
  person,
  canvas,
  active,
  onSelect,
  onOpen
}: {
  placement: Placement;
  scale: number;
  person?: Person;
  canvas?: HTMLCanvasElement;
  active: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasPaint(ref, canvas);

  // When face detection finishes, fade the re-framed photo in so the
  // automatic crop reads as a change rather than a jump.
  const status = person?.faceStatus;
  const wasLooking = useRef(status === 'looking');
  const [refined, setRefined] = useState(false);
  useEffect(() => {
    if (wasLooking.current && status && status !== 'looking') setRefined(true);
    wasLooking.current = status === 'looking';
  }, [status]);

  const style = {
    width: p.w * scale,
    height: p.h * scale,
    transform: `translate(${p.x * scale}px, ${p.y * scale}px)`
  };

  if (!person) {
    return (
      <div className="cell cell--sample" style={style} aria-hidden="true">
        <svg viewBox="0 0 40 48" preserveAspectRatio="xMidYMax meet">
          <circle cx="20" cy="18" r="8" />
          <path d="M5 48c0-10 6.5-16 15-16s15 6 15 16z" />
        </svg>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`cell${active ? ' cell--active' : ''}${person.faceStatus === 'looking' ? ' cell--scanning' : ''}${refined ? ' cell--refined' : ''}`}
      style={style}
      onClick={onSelect}
      onDoubleClick={onOpen}
      aria-label={`${person.name}, ${p.item.size.label}. Click for photo tools, double-click to adjust the crop.`}
    >
      <canvas ref={ref} />
    </button>
  );
}

function GuidesOverlay({ sheet, scale }: { sheet: Sheet; scale: number }) {
  const style = useStore(s => s.settings.cutStyle);
  const calibration = useStore(s => s.settings.calibration);
  const guides = buildGuides(sheet, style);
  const cal = calibration ? placeCalibration(sheet) : null;
  // Keep hairlines visible on screen even when the real stroke is under a pixel.
  const stroke = Math.max(guides.stroke, 1 / scale);
  const color = guides.tone === 'mark' ? '#1a1a1a' : '#9e9e9e';

  return (
    <svg className="guides" viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`} aria-hidden="true">
      {guides.segments.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={color} strokeWidth={stroke} />
      ))}
      {cal ? (
        <g stroke="#1a1a1a" strokeWidth={Math.max(0.15, 1 / scale)}>
          <line x1={cal.x} y1={cal.y} x2={cal.x + cal.length} y2={cal.y} />
          <line x1={cal.x} y1={cal.y - 1} x2={cal.x} y2={cal.y + 1} />
          <line x1={cal.x + cal.length} y1={cal.y - 1} x2={cal.x + cal.length} y2={cal.y + 1} />
          <text x={cal.x + cal.length + 1.5} y={cal.y} fontSize={2} dominantBaseline="middle" stroke="none" fill="#1a1a1a">
            {calibrationLabel(sheet, cal)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
