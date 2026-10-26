import { useMemo, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { renderCell, personLook, type Person } from '../lib/person';
import { PHOTO_SIZES } from '../lib/sizes';
import { findPackage, useStore } from '../state/store';
import { useLayout } from '../state/useLayout';
import { useCanvasPaint } from './useCanvasPaint';

/** "Package B" reads as B and "Whole sheet 1x1" as 1x1, as on the package board. */
const shortName = (name: string) => (name.startsWith('Package ') ? name.slice('Package '.length) : name.replace(/^Whole sheet /, ''));

/**
 * The customers on this sheet, as order slips laid down the side of the mat:
 * their photo, their name, the package letter and how many prints it makes.
 * Picking one points the package board at them and opens their photo tools.
 */
export function PeopleStrip({ onBrowse, onOpen }: { onBrowse: () => void; onOpen: (personId: string) => void }) {
  const people = useStore(s => s.people);
  const activeId = useStore(s => s.activeId);
  const custom = useStore(s => s.customPackages);
  const removePerson = useStore(s => s.removePerson);
  const layout = useLayout();

  // Prints per customer across every sheet, so a fill package shows what it actually made.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const sheet of layout.sheets) for (const p of sheet.placements) map.set(p.item.personId, (map.get(p.item.personId) ?? 0) + 1);
    return map;
  }, [layout]);

  if (people.length === 0) return null;

  return (
    <div className="people" role="list" aria-label="Customers on this sheet">
      {people.map(person => {
        const pkg = findPackage(custom, person.packageId, person.packageSnapshot);
        const active = person.id === activeId;
        const prints = counts.get(person.id) ?? 0;
        return (
          <div key={person.id} role="listitem" className={`person${active ? ' person--active' : ''}`}>
            <button type="button" className="person-main" onClick={() => onOpen(person.id)} aria-pressed={active} aria-label={`${person.name}, ${pkg.name}, ${prints} prints`}>
              <Thumb person={person} />
              <span className="person-text" aria-hidden="true">
                <span className="person-name">{person.name}</span>
                <span className="person-pkg">
                  {prints} print{prints === 1 ? '' : 's'}
                </span>
              </span>
              <span className="person-letter" aria-hidden="true" title={pkg.name}>
                {shortName(pkg.name)}
              </span>
            </button>
            <button type="button" className="person-remove" onClick={() => removePerson(person.id)} aria-label={`Remove ${person.name}`}>
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>
        );
      })}
      <button type="button" className="person-add" onClick={onBrowse}>
        <Plus size={16} strokeWidth={2.2} />
        Add customer
      </button>
    </div>
  );
}

function Thumb({ person }: { person: Person }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const look = personLook(person);
  // Re-render only when the photo's look changes.
  const source = useMemo(() => renderCell(person, PHOTO_SIZES[0], 96), [look]);
  useCanvasPaint(ref, source);

  return <canvas ref={ref} className="person-thumb" aria-hidden="true" />;
}
