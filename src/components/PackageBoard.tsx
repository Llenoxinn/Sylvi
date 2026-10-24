import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { PhotoPackage } from '../lib/packages';
import type { PhotoSize } from '../lib/sizes';
import { allPackages, findPackage, useStore } from '../state/store';

/** "Package B" reads as B and "Whole sheet 1x1" as 1x1, the way a shop's price board lists them. */
const shortName = (name: string) => (name.startsWith('Package ') ? name.slice('Package '.length) : name.replace(/^Whole sheet /, ''));

const contents = (pkg: PhotoPackage) =>
  pkg.items.map(i => (i.count === 'fill' ? `${i.size.label} fill` : `${i.count} × ${i.size.label}`)).join(', ');

/**
 * The packages across the top of the workspace, like the price board on a
 * shop's wall. Each tile draws the prints the customer walks away with. Picking one sets it for the selected customer, or for the next
 * photo when there's none.
 */
export function PackageBoard({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) {
  const people = useStore(s => s.people);
  const activeId = useStore(s => s.activeId);
  const custom = useStore(s => s.customPackages);
  const settings = useStore(s => s.settings);
  const setPersonPackage = useStore(s => s.setPersonPackage);
  const updateSettings = useStore(s => s.updateSettings);
  const listRef = useRef<HTMLDivElement>(null);

  const active = people.find(p => p.id === activeId) ?? null;
  const packages = allPackages(custom);
  const savedId = active?.packageSnapshot ? `saved:${active.id}` : null;
  if (savedId && active?.packageSnapshot) packages.push({ ...active.packageSnapshot, id: savedId, name: `${active.packageSnapshot.name} (saved job)` });
  const currentId = savedId ?? (active ? active.packageId : settings.defaultPackageId);
  const current = packages.find(p => p.id === currentId) ?? findPackage(custom, currentId);

  const choose = (pkg: PhotoPackage) => {
    if (pkg.id === currentId) return;
    if (active) setPersonPackage(active.id, pkg.id);
    else updateSettings({ defaultPackageId: pkg.id });
  };

  // Arrow keys move along the board, as in any radio group.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = packages.findIndex(p => p.id === current.id);
    const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: packages.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const pkg = packages[Math.max(0, Math.min(packages.length - 1, next))];
    choose(pkg);
    listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(pkg.id)}"]`)?.focus();
  };

  // Keep the chosen tile in view when it changes from elsewhere, such as picking another customer.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current.id]);

  return (
    <nav className="board" aria-label="Package">
      <div className="board-label">
        <span className="board-title">Package</span>
        <span className="board-for">{active ? `for ${active.name}` : 'for the next photo'}</span>
      </div>

      <div ref={listRef} className="board-list" role="radiogroup" aria-label="Package" onKeyDown={onKeyDown}>
        {packages.map(pkg => {
          const selected = pkg.id === current.id;
          return (
            <button
              key={pkg.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              data-id={pkg.id}
              className="board-item"
              onClick={() => choose(pkg)}
              title={`${pkg.name}: ${contents(pkg)}`}
            >
              <PackageIcon pkg={pkg} />
              <span className="board-text">
                <span className="board-name">{shortName(pkg.name)}</span>
                <Contents pkg={pkg} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="board-actions">
        <button type="button" className="btn btn--sm" disabled={!!savedId} onClick={() => onEdit(current.id)}>
          <Pencil size={14} />
          {savedId ? 'Saved job' : current.builtIn ? 'Copy and edit' : 'Edit'}
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCreate}>
          <Plus size={14} />
          New
        </button>
      </div>
    </nav>
  );
}

/** "2 × 2x2, 7 × 1x1", with the counts in ink, the × faint and the sizes quieter, so it doesn't read as arithmetic. */
function Contents({ pkg }: { pkg: PhotoPackage }) {
  return (
    <span className="board-items">
      {pkg.items.map((item, i) => (
        <span key={i} className="board-item-part">
          {i > 0 ? ', ' : null}
          {item.count === 'fill' ? (
            <>
              <span className="board-size">{item.size.label}</span> <span className="board-times">fill</span>
            </>
          ) : (
            <>
              <span className="board-count">{item.count}</span>
              <span className="board-times"> × </span>
              <span className="board-size">{item.size.label}</span>
            </>
          )}
        </span>
      ))}
    </span>
  );
}

// Each icon is 40 units square; its biggest print stands 20 units tall or wide, and the rest keep their true size against it.
const BOX = 40;
const BIGGEST = 20;

type Print = { size: PhotoSize; x: number; y: number; turn: number; pivot?: [number, number] };

/**
 * The prints a package hands the customer, as they'd lie on the counter, at
 * true size against each other. Mixed sizes tuck the smaller print over the
 * bigger one's corner; one size fans two like cards; a whole-sheet fill fans three.
 */
function PackageIcon({ pkg }: { pkg: PhotoPackage }) {
  const items = [...pkg.items].sort((a, b) => b.size.widthMm * b.size.heightMm - a.size.widthMm * a.size.heightMm);
  const biggest = items[0].size;
  const k = BIGGEST / Math.max(biggest.widthMm, biggest.heightMm);
  const dims = (size: PhotoSize) => ({ w: size.widthMm * k, h: size.heightMm * k });

  let prints: Print[];
  if (items.length > 1) {
    const back = dims(items[0].size);
    const front = dims(items[1].size);
    const fx = back.w * 0.58;
    const fy = back.h * 0.5;
    const ox = (BOX - Math.max(back.w, fx + front.w)) / 2;
    const oy = (BOX - Math.max(back.h, fy + front.h)) / 2;
    prints = [
      { size: items[0].size, x: ox, y: oy, turn: -7 },
      { size: items[1].size, x: ox + fx, y: oy + fy, turn: 6 }
    ];
  } else {
    const { w, h } = dims(biggest);
    const x = (BOX - w) / 2;
    const y = (BOX - h) / 2 - 1;
    // Fanned from a point below the prints, like a hand of cards; the last one drawn sits on top.
    const pivot: [number, number] = [BOX / 2, y + h * 1.4];
    const turns = items[0].count === 'fill' ? [-16, 16, 0] : items[0].count === 1 ? [-4] : [-10, 8];
    prints = turns.map(turn => ({ size: biggest, x, y, turn, pivot }));
  }

  return (
    <svg className="board-icon" viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden="true">
      {prints.map((print, i) => {
        const { w, h } = dims(print.size);
        const [px, py] = print.pivot ?? [print.x + w / 2, print.y + h / 2];
        // The head sits higher on a passport, as its crop rules ask.
        const head = Math.min(w, h) * 0.2;
        const headY = h * (print.size.key === 'passport' ? 0.36 : 0.4);
        const shoulder = h * 0.66;
        return (
          <g key={i} transform={`rotate(${print.turn} ${px} ${py}) translate(${print.x} ${print.y})`}>
            {/* A gap in the tile's own colour where prints overlap, so each edge stays crisp. */}
            {i > 0 ? <rect className="board-icon-gap" x={-1.4} y={-1.4} width={w + 2.8} height={h + 2.8} rx={2.4} /> : null}
            <rect className="board-icon-print" width={w} height={h} rx={1.2} />
            <circle className="board-icon-figure" cx={w / 2} cy={headY} r={head} />
            <path
              className="board-icon-figure"
              d={`M ${w * 0.16} ${h} C ${w * 0.16} ${shoulder} ${w * 0.84} ${shoulder} ${w * 0.84} ${h} Z`}
            />
          </g>
        );
      })}
    </svg>
  );
}
