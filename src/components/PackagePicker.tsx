import { useMemo, useSyncExternalStore } from 'react';
import { Pencil, Plus } from 'lucide-react';
import OptionWheel from './reactbits/OptionWheel/OptionWheel';
import { allPackages, findPackage, useStore } from '../state/store';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const subscribeMotion = (cb: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', cb);
  return () => query.removeEventListener('change', cb);
};

export function PackagePicker({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) {
  const people = useStore(s => s.people);
  const activeId = useStore(s => s.activeId);
  const custom = useStore(s => s.customPackages);
  const defaultPackageId = useStore(s => s.settings.defaultPackageId);
  const setPersonPackage = useStore(s => s.setPersonPackage);
  const updateSettings = useStore(s => s.updateSettings);
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);

  const active = people.find(p => p.id === activeId) ?? null;
  const packages = allPackages(custom);
  const savedId = active?.packageSnapshot ? `saved:${active.id}` : null;
  if (savedId && active?.packageSnapshot) packages.push({ ...active.packageSnapshot, id: savedId, name: `${active.packageSnapshot.name} (saved job)` });
  const currentId = savedId ?? (active ? active.packageId : defaultPackageId);
  const current = packages.find(p => p.id === currentId) ?? findPackage(custom, currentId);
  const index = Math.max(0, packages.findIndex(p => p.id === current.id));
  const namesKey = packages.map(p => p.name).join('\u0000');
  const names = useMemo(() => namesKey.split('\u0000'), [namesKey]);

  const choose = (i: number) => {
    const pkg = packages[i];
    if (!pkg || pkg.id === currentId) return;
    if (active) setPersonPackage(active.id, pkg.id);
    else updateSettings({ defaultPackageId: pkg.id });
  };

  return (
    <aside className="pane pane--packages" aria-label="Package">
      <div className="pane-head">
        <h2 className="pane-title">Package</h2>
        <span className="pane-sub">{active ? `for ${active.name}` : 'for the next photo'}</span>
      </div>

      <div className="wheel-wrap">
        <OptionWheel
          // Remount when the list or the person changes so the wheel starts on their package.
          key={`${active?.id ?? 'none'}|${names.length}|${currentId}`}
          items={names}
          defaultSelected={index}
          onChange={choose}
          textColor="var(--ink-3)"
          activeColor="var(--ink)"
          side="left"
          fontSize={1.375}
          spacing={1.7}
          curve={1}
          tilt={8}
          blur={reduce ? 0 : 1.2}
          fade={0.2}
          minOpacity={0.12}
          smoothing={reduce ? 1 : 180}
          inset={20}
          className="package-wheel"
        />
      </div>

      <div className="package-card">
        <ul className="package-items" aria-label={`${current.name} contents`}>
          {current.items.map((item, i) => (
            <li key={i}>
              <span className="package-count">{item.count === 'fill' ? 'Fill' : `${item.count}×`}</span>
              <span>{item.size.label}</span>
            </li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="btn btn--sm" disabled={!!savedId} onClick={() => onEdit(current.id)}>
            <Pencil size={14} />
            {savedId ? 'Saved job package' : current.builtIn ? 'Copy and edit' : 'Edit'}
          </button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onCreate}>
            <Plus size={14} />
            New
          </button>
        </div>
        <p className="hint">Scroll, drag or use the arrow keys to change the package.</p>
      </div>
    </aside>
  );
}
