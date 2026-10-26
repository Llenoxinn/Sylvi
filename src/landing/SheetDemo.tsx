import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { buildPackItems } from '../lib/layout/items';
import { pack, type Sheet } from '../lib/layout/pack';
import { BUILT_IN_PACKAGES, type PhotoPackage } from '../lib/packages';
import { PAPERS } from '../lib/papers';
import { mmToIn } from '../lib/units';

// The same customer as the photo-to-trimmer sequence above, so picking a package reads as "same photo, other order".
const CROP = '/landing/press-crop.jpg';
const PAPER_IDS = ['3r', '4r', '5r', 'a4'];
const shortName = (name: string) => (name.startsWith('Package ') ? name.slice('Package '.length) : name.replace(/^Whole sheet /, ''));
// Strong ease-in-out for prints moving across the sheet, strong ease-out for anything arriving.
const MOVE = 'cubic-bezier(0.77, 0, 0.175, 1)';
const ARRIVE = 'cubic-bezier(0.23, 1, 0.32, 1)';

type Box = { x: number; y: number; w: number; h: number };
type Layout = { sheet: Sheet; sheets: number; photos: number };

/** Sylvi's own packer, run for one package on one paper, as the app runs it. */
function layoutFor(pkg: PhotoPackage, paperId: string): Layout | null {
  const paper = PAPERS.find(p => p.id === paperId);
  if (!paper) return null;
  const result = pack(buildPackItems([{ personId: 'demo', pkg }], paper.widthMm * paper.heightMm), {
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    marginMm: paper.marginMm,
    gapMm: 0,
    orientation: 'auto'
  });
  const sheet = result.sheets[0];
  if (!sheet) return null;
  return { sheet, sheets: result.sheets.length, photos: result.sheets.reduce((n, s) => n + s.placements.length, 0) };
}

const inches = (mm: number) => `${Number(mmToIn(mm).toFixed(1))} in`;

/**
 * The built-in packages as a shop's menu board beside a live sheet. Picking a
 * package or a paper runs the real packer, and every print glides from where
 * it was to where the packer put it; then the cuts redraw and the sheet is
 * measured again. Without motion the sheet simply changes.
 */
export function SheetDemo() {
  const [pkgId, setPkgId] = useState('pkg-b');
  const [paperId, setPaperId] = useState('4r');
  const [slot, setSlot] = useState({ w: 0, h: 0 });
  // Hides the finished sheet until its first-sight sequence plays. Set only by script, so it never strands content.
  const [pending, setPending] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const prev = useRef<{ cells: Box[]; paper: Box } | null>(null);
  const [selectY, setSelectY] = useState<{ y: number; h: number } | null>(null);

  // Every package's count on the current paper, for the board's right-hand column.
  const layouts = useMemo(() => new Map(BUILT_IN_PACKAGES.map(p => [p.id, layoutFor(p, paperId)])), [paperId]);
  const layout = layouts.get(pkgId) ?? null;

  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSlot({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The sheet fitted into its slot and centred, leaving room above and right for its dimension lines;
  // every print in slot coordinates.
  const geometry = useMemo(() => {
    if (!layout || !slot.w) return null;
    const { sheet } = layout;
    const room = { top: 32, right: 36 };
    const scale = Math.min((slot.w - room.right) / sheet.widthMm, (slot.h - room.top) / sheet.heightMm);
    const paper: Box = { w: sheet.widthMm * scale, h: sheet.heightMm * scale, x: 0, y: 0 };
    paper.x = (slot.w - room.right - paper.w) / 2;
    paper.y = room.top + (slot.h - room.top - paper.h) / 2;
    const cells: Box[] = sheet.placements.map(p => ({ x: paper.x + p.x * scale, y: paper.y + p.y * scale, w: p.w * scale, h: p.h * scale }));
    return { scale, paper, cells };
  }, [layout, slot]);

  // The selection's crop marks glide down the board to the chosen row.
  useLayoutEffect(() => {
    const row = boardRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (row) setSelectY({ y: row.offsetTop, h: row.offsetHeight });
  }, [pkgId, slot.w]);

  // Hold the sheet back until it scrolls into view, when motion is welcome.
  useLayoutEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPending(true);
  }, []);

  useEffect(() => {
    const el = slotRef.current;
    if (!pending || !el || !geometry) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setPending(false);
        arrive(el);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pending, geometry]);

  // Repack: each print glides from its old box to its new one; the paper resizes under them.
  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!geometry || !el) return;
    const before = prev.current;
    prev.current = { cells: geometry.cells, paper: geometry.paper };
    if (!before || pending) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.querySelectorAll('.demo-cell, .demo-cuts, .demo-measure').forEach(node => node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' }));
      return;
    }
    const flip = (from: Box, to: Box) => `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.w / to.w}, ${from.h / to.h})`;
    el.querySelector('.demo-paper')?.animate([{ transform: flip(before.paper, geometry.paper) }, { transform: 'none' }], { duration: 480, easing: MOVE });
    geometry.cells.forEach((box, i) => {
      const cell = cellRefs.current[i];
      if (!cell) return;
      const from = before.cells[i];
      if (from) cell.animate([{ transform: flip(from, box) }, { transform: 'none' }], { duration: 480, easing: MOVE });
      else cell.animate([{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 300 + (i % 16) * 20, easing: ARRIVE, fill: 'backwards' });
    });
    drawCuts(el, 460);
    el.querySelector('.demo-measure')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 520, easing: ARRIVE, fill: 'backwards' });
    // Only the box changes; pending is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  const packages = BUILT_IN_PACKAGES;
  const pkg = packages.find(p => p.id === pkgId)!;
  const paper = PAPERS.find(p => p.id === paperId)!;
  const caption = layout
    ? `${layout.photos} photos on ${layout.sheets === 1 ? 'one sheet' : `${layout.sheets} sheets`} of ${paper.label}${paper.marginMm === 0 ? ', borderless' : ''}`
    : '';

  // Arrow keys move along the board, as in any radio group.
  const onBoardKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = packages.findIndex(p => p.id === pkgId);
    const next = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: packages.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = packages[(next + packages.length) % packages.length];
    setPkgId(target.id);
    boardRef.current?.querySelector<HTMLElement>(`[data-id="${target.id}"]`)?.focus();
  };

  return (
    <div className="demo">
      <div className="demo-menu">
        <div ref={boardRef} className="demo-board" role="radiogroup" aria-label="Package" onKeyDown={onBoardKey}>
          {selectY ? <span className="demo-select" style={{ transform: `translateY(${selectY.y}px)`, height: selectY.h }} aria-hidden="true" /> : null}
          {packages.map(p => {
            const fit = layouts.get(p.id);
            const on = p.id === pkgId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                data-id={p.id}
                className="demo-row"
                onClick={() => setPkgId(p.id)}
              >
                <span className="demo-row-name">{shortName(p.name)}</span>
                <span className="demo-row-items">
                  {p.items.map((item, i) => (
                    <span key={i}>
                      {i > 0 ? ', ' : null}
                      {item.count === 'fill' ? 'As many as fit on the sheet' : `${item.count} × ${item.size.label}`}
                    </span>
                  ))}
                </span>
                {fit ? (
                  <span className="demo-row-count">
                    {fit.photos} photos{fit.sheets > 1 ? `, ${fit.sheets} sheets` : ''}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="demo-papers" role="radiogroup" aria-label="Paper">
          <span className="demo-papers-label" aria-hidden="true">
            Paper
          </span>
          {PAPER_IDS.map(id => {
            const p = PAPERS.find(x => x.id === id)!;
            return (
              <button key={id} type="button" role="radio" aria-checked={id === paperId} className="demo-chip" title={p.hint} onClick={() => setPaperId(id)}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <figure className="demo-stage">
        <div
          ref={slotRef}
          className="demo-slot"
          data-pending={pending ? '' : undefined}
          role="img"
          aria-label={`${pkg.name} laid out by Sylvi: ${caption}, every cut running edge to edge.`}
        >
          {geometry && layout ? (
            <>
              <span className="demo-paper" style={{ left: geometry.paper.x, top: geometry.paper.y, width: geometry.paper.w, height: geometry.paper.h }} />
              {geometry.cells.map((c, i) => (
                <span
                  key={i}
                  ref={el => {
                    cellRefs.current[i] = el;
                  }}
                  className="demo-cell"
                  style={{ left: c.x, top: c.y, width: c.w, height: c.h, backgroundImage: `url(${CROP})` }}
                />
              ))}
              <svg
                className="demo-cuts"
                style={{ left: geometry.paper.x, top: geometry.paper.y, width: geometry.paper.w, height: geometry.paper.h }}
                viewBox={`0 0 ${layout.sheet.widthMm} ${layout.sheet.heightMm}`}
                // About 1.5 screen pixels at any paper size, set in sheet millimetres so the dash draw stays exact.
                strokeWidth={1.5 / geometry.scale}
                aria-hidden="true"
              >
                {layout.sheet.cuts.map((c, i) =>
                  c.axis === 'h' ? (
                    <line key={i} x1={c.from - 3} y1={c.pos} x2={c.to + 3} y2={c.pos} pathLength={1} />
                  ) : (
                    <line key={i} x1={c.pos} y1={c.from - 3} x2={c.pos} y2={c.to + 3} pathLength={1} />
                  )
                )}
              </svg>
              {/* Measured like a print on the mat, as in the hero. */}
              <span className="demo-measure" style={{ left: geometry.paper.x, top: geometry.paper.y, width: geometry.paper.w, height: geometry.paper.h }} aria-hidden="true">
                <span className="dim dim--w">
                  <span>{inches(layout.sheet.widthMm)}</span>
                </span>
                <span className="dim dim--h">
                  <span>{inches(layout.sheet.heightMm)}</span>
                </span>
              </span>
            </>
          ) : null}
        </div>
        <figcaption className="demo-caption" aria-live="polite">
          <b>{pkg.name}</b> {caption}.
        </figcaption>
      </figure>
    </div>
  );
}

/** The cuts draw edge to edge, one after another, like passes on the trimmer. */
function drawCuts(slot: HTMLElement, delay: number) {
  slot.querySelectorAll<SVGLineElement>('.demo-cuts line').forEach((line, i) => {
    line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 360, delay: delay + i * 70, easing: ARRIVE, fill: 'backwards' });
  });
}

/** First sight: the prints land on the paper one by one, then the cuts draw, then it's measured. */
function arrive(slot: HTMLElement) {
  const cells = slot.querySelectorAll<HTMLElement>('.demo-cell');
  slot.querySelector('.demo-paper')?.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: ARRIVE, fill: 'backwards' });
  cells.forEach((cell, i) => {
    cell.animate([{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: 180 + i * 40, easing: ARRIVE, fill: 'backwards' });
  });
  const settled = 180 + cells.length * 40 + 120;
  drawCuts(slot, settled);
  slot.querySelector('.demo-measure')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: settled + 360, easing: ARRIVE, fill: 'backwards' });
}
