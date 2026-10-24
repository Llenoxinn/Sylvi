import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { PhotoPackage } from '../lib/packages';
import { allPackages, findPackage, useStore } from '../state/store';
import { computeLayout } from '../state/useLayout';

/** "Package B" reads as B and "Whole sheet 1x1" as 1x1, the way a shop's price board lists them. */
const shortName = (name: string) => (name.startsWith('Package ') ? name.slice('Package '.length) : name.replace(/^Whole sheet /, ''));

const contents = (pkg: PhotoPackage) =>
  pkg.items.map(i => (i.count === 'fill' ? `${i.size.label} fill` : `${i.count} × ${i.size.label}`)).join(', ');

/**
 * The packages across the top of the workspace, like the price board on a
 * shop's wall. Each tile previews the sheet it makes on the paper that's
 * loaded. Picking one sets it for the selected customer, or for the next
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
              <BoardPreview pkg={pkg} />
              <span className="board-text">
                <span className="board-name">{shortName(pkg.name)}</span>
                <span className="board-items">{contents(pkg)}</span>
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

/** The first sheet this package makes on the loaded paper, drawn as blank cells. */
function BoardPreview({ pkg }: { pkg: PhotoPackage }) {
  const paper = useStore(s => s.settings.paper);
  const cutStyle = useStore(s => s.settings.cutStyle);
  const settings = useStore(s => s.settings);
  const sheet = useMemo(
    () => computeLayout([{ personId: 'board', pkg }], settings).sheets[0],
    // Only the paper and gaps change the preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pkg, paper, cutStyle]
  );
  if (!sheet) return <span className="board-preview" aria-hidden="true" />;
  return (
    <svg className="board-preview" viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`} aria-hidden="true">
      <rect width={sheet.widthMm} height={sheet.heightMm} className="board-preview-paper" />
      {sheet.placements.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} className="board-preview-cell" />
      ))}
    </svg>
  );
}
