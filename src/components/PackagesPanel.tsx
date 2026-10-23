import { useEffect, useId, useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import { describePackage, type PackageItem, type PhotoPackage } from '../lib/packages';
import { customSize, PHOTO_SIZES } from '../lib/sizes';
import { MAX_PACKAGE_ITEMS } from '../lib/limits';
import { formatSize, inToMm, mmToIn } from '../lib/units';
import { allPackages, findPackage, useStore } from '../state/store';
import { computeLayout } from '../state/useLayout';
import { Dialog } from './ui';

export type PackagesIntent = { mode: 'list' } | { mode: 'edit'; id: string } | { mode: 'new' };

export function PackagesPanel({ intent, onIntent }: { intent: PackagesIntent; onIntent: (i: PackagesIntent) => void }) {
  const open = useStore(s => s.panel === 'packages');
  const custom = useStore(s => s.customPackages);
  const close = () => {
    useStore.getState().openPanel(null);
    onIntent({ mode: 'list' });
  };

  // Built once per intent: copies of built-in packages get a fresh id that must stay stable while editing.
  const editing: PhotoPackage | null = useMemo(
    () =>
      intent.mode === 'new'
        ? { id: crypto.randomUUID(), name: '', items: [{ size: PHOTO_SIZES[0], count: 8 }], updatedAt: 0 }
        : intent.mode === 'edit'
          ? copyIfBuiltIn(findPackage(custom, intent.id))
          : null,
    [intent]
  );

  return (
    <Dialog open={open} title={editing ? (intent.mode === 'new' || editing.name === '' ? 'New package' : `Edit ${editing.name}`) : 'Packages'} onClose={close} wide>
      {editing ? (
        <PackageEditor key={editing.id} initial={editing} onDone={() => onIntent({ mode: 'list' })} />
      ) : (
        <PackageList onIntent={onIntent} />
      )}
    </Dialog>
  );
}

function copyIfBuiltIn(pkg: PhotoPackage): PhotoPackage {
  if (!pkg.builtIn) return pkg;
  return { ...pkg, id: crypto.randomUUID(), name: `${pkg.name} (my version)`, builtIn: false, items: pkg.items.map(i => ({ ...i })) };
}

function PackageList({ onIntent }: { onIntent: (i: PackagesIntent) => void }) {
  const custom = useStore(s => s.customPackages);
  const account = useStore(s => s.account);
  const deletePackage = useStore(s => s.deletePackage);

  return (
    <>
      <div className="row row--split">
        <p className="hint">
          {account ? 'Your packages sync to your shop account.' : 'Guest packages stay in this browser. Sign in to use your shop’s separate packages.'}
        </p>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onIntent({ mode: 'new' })}>
          <Plus size={15} />
          New package
        </button>
      </div>
      <ul className="pkg-list">
        {allPackages(custom).map(pkg => (
          <li key={pkg.id} className="pkg-row">
            <div>
              <p className="pkg-name">
                {pkg.name}
                {pkg.builtIn ? <span className="tag">Built in</span> : null}
              </p>
              <p className="hint">{describePackage(pkg)}</p>
            </div>
            <div className="row">
              <button type="button" className="btn btn--sm" onClick={() => onIntent({ mode: 'edit', id: pkg.id })}>
                {pkg.builtIn ? <Copy size={14} /> : <Pencil size={14} />}
                {pkg.builtIn ? 'Copy' : 'Edit'}
              </button>
              {!pkg.builtIn ? (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost btn--icon btn--danger"
                  aria-label={`Delete ${pkg.name}`}
                  onClick={() => confirm(`Delete “${pkg.name}”?`) && deletePackage(pkg.id)}
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function PackageEditor({ initial, onDone }: { initial: PhotoPackage; onDone: () => void }) {
  const unit = useStore(s => s.settings.unit);
  const settings = useStore(s => s.settings);
  const savePackage = useStore(s => s.savePackage);
  const toast = useStore(s => s.toast);
  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<PackageItem[]>(initial.items);
  const [saveError, setSaveError] = useState('');
  const nameId = useId();

  const preview = computeLayout([{ personId: 'preview', pkg: { ...initial, items } }], settings);
  const sheet = preview.sheets[0];
  const valid = name.trim().length > 0 && items.length > 0 && !preview.error && items.every(i => i.count === 'fill' || i.count > 0);

  const patch = (index: number, next: Partial<PackageItem>) => setItems(list => list.map((it, i) => (i === index ? { ...it, ...next } : it)));

  return (
    <div className="editor">
      <div className="editor-form">
        <div className="field">
          <label className="field-label" htmlFor={nameId}>
            Package name
          </label>
          <input id={nameId} className="input" value={name} maxLength={60} placeholder="Package E" onChange={e => setName(e.target.value)} autoFocus />
        </div>

        <div className="field">
          <span className="field-label">Photos</span>
          <ul className="editor-items">
            {items.map((item, i) => (
              <ItemRow key={i} item={item} unit={unit} onChange={next => patch(i, next)} onRemove={items.length > 1 ? () => setItems(l => l.filter((_, j) => j !== i)) : undefined} />
            ))}
          </ul>
          <button type="button" className="btn btn--sm btn--ghost" disabled={items.length >= MAX_PACKAGE_ITEMS} onClick={() => setItems(l => [...l, { size: PHOTO_SIZES[1], count: 2 }])}>
            <Plus size={14} />
            Add a size
          </button>
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!valid}
            onClick={() => {
              if (savePackage({ ...initial, name: name.trim(), items })) {
                toast(`Saved ${name.trim()}.`, 'success');
                onDone();
              } else setSaveError('Browser storage couldn’t save this package. Free some space and try again.');
            }}
          >
            Save package
          </button>
        </div>
        {saveError ? <p className="hint" role="alert">{saveError}</p> : null}
      </div>

      <figure className="editor-preview">
        {sheet ? (
          <svg viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`} role="img" aria-label="Preview of this package on the current paper">
            <rect width={sheet.widthMm} height={sheet.heightMm} className="ep-paper" />
            {sheet.placements.map(p => (
              <rect key={p.item.id} x={p.x} y={p.y} width={p.w} height={p.h} className="ep-cell" />
            ))}
          </svg>
        ) : null}
        <figcaption className="hint">
          {preview.error ? preview.error : preview.unplaced.length
            ? `${preview.unplaced.length} photo${preview.unplaced.length === 1 ? ' doesn’t' : 's don’t'} fit this paper.`
            : `${preview.sheets.length} sheet${preview.sheets.length === 1 ? '' : 's'} on your current paper.`}
        </figcaption>
      </figure>
    </div>
  );
}

function ItemRow({
  item,
  unit,
  onChange,
  onRemove
}: {
  item: PackageItem;
  unit: 'in' | 'mm';
  onChange: (next: Partial<PackageItem>) => void;
  onRemove?: () => void;
}) {
  const isCustom = !PHOTO_SIZES.some(s => s.key === item.size.key);
  const [w, setW] = useState(display(item.size.widthMm, unit));
  const [h, setH] = useState(display(item.size.heightMm, unit));
  const [sizeError, setSizeError] = useState('');
  useEffect(() => {
    setW(display(item.size.widthMm, unit));
    setH(display(item.size.heightMm, unit));
  }, [unit, item.size.widthMm, item.size.heightMm]);

  const applyCustom = (wv: number, hv: number) => {
    const toMm = (v: number) => (unit === 'in' ? inToMm(v) : v);
    try {
      onChange({ size: customSize(toMm(wv), toMm(hv), formatSize(toMm(wv), toMm(hv), unit).replace(` ${unit}`, '')) });
      setSizeError('');
    } catch (error) {
      setSizeError(error instanceof Error ? error.message : 'Choose a valid photo size.');
      setW(display(item.size.widthMm, unit));
      setH(display(item.size.heightMm, unit));
    }
  };

  return (
    <li className="editor-item">
      <select
        className="select"
        aria-label="Photo size"
        value={isCustom ? 'custom' : item.size.key}
        onChange={e => {
          setSizeError('');
          if (e.target.value === 'custom') applyCustom(Number(w) || 1, Number(h) || 1);
          else onChange({ size: PHOTO_SIZES.find(s => s.key === e.target.value)! });
        }}
      >
        {PHOTO_SIZES.map(s => (
          <option key={s.key} value={s.key}>
            {s.label} ({formatSize(s.widthMm, s.heightMm, unit)})
          </option>
        ))}
        <option value="custom">Custom size</option>
      </select>

      {isCustom ? (
        <div className="row editor-custom">
          <input className="input" aria-label={`Width in ${unit}`} type="number" min={0} step="any" value={w} onChange={e => setW(e.target.value)} onBlur={() => applyCustom(Number(w), Number(h))} />
          <span aria-hidden="true">×</span>
          <input className="input" aria-label={`Height in ${unit}`} type="number" min={0} step="any" value={h} onChange={e => setH(e.target.value)} onBlur={() => applyCustom(Number(w), Number(h))} />
          <span className="hint">{unit}</span>
        </div>
      ) : null}
      {sizeError ? <p className="hint" role="alert">{sizeError}</p> : null}

      <div className="row">
        <input
          className="input editor-count"
          aria-label="Number of copies"
          type="number"
          min={1}
          max={200}
          disabled={item.count === 'fill'}
          value={item.count === 'fill' ? '' : item.count}
          placeholder="Fill"
          onChange={e => onChange({ count: Math.max(1, Math.min(200, Number(e.target.value) || 1)) })}
        />
        <label className="check">
          <input type="checkbox" checked={item.count === 'fill'} onChange={e => onChange({ count: e.target.checked ? 'fill' : 4 })} />
          Fill the rest
        </label>
        {onRemove ? (
          <button type="button" className="btn btn--sm btn--ghost btn--icon" onClick={onRemove} aria-label="Remove this size">
            <X size={15} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

const display = (mm: number, unit: 'in' | 'mm') => String(unit === 'in' ? Number(mmToIn(mm).toFixed(3)) : Number(mm.toFixed(1)));
