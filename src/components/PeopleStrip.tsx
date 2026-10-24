import { useMemo, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { renderCell, personLook, type Person } from '../lib/person';
import { PHOTO_SIZES } from '../lib/sizes';
import { findPackage, useStore } from '../state/store';
import { useCanvasPaint } from './useCanvasPaint';

/** The customers on this sheet. Picking one points the package board at them and opens their photo tools. */
export function PeopleStrip({ onBrowse, onOpen }: { onBrowse: () => void; onOpen: (personId: string) => void }) {
  const people = useStore(s => s.people);
  const activeId = useStore(s => s.activeId);
  const custom = useStore(s => s.customPackages);
  const removePerson = useStore(s => s.removePerson);

  if (people.length === 0) return null;

  return (
    <div className="people" role="list" aria-label="Customers on this sheet">
      {people.map(person => {
        const pkg = findPackage(custom, person.packageId, person.packageSnapshot);
        const active = person.id === activeId;
        return (
          <div key={person.id} role="listitem" className={`person${active ? ' person--active' : ''}`}>
            <button type="button" className="person-main" onClick={() => onOpen(person.id)} aria-pressed={active}>
              <Thumb person={person} />
              <span className="person-text">
                <span className="person-name">{person.name}</span>
                <span className="person-pkg">{pkg.name}</span>
              </span>
            </button>
            <button type="button" className="person-remove" onClick={() => removePerson(person.id)} aria-label={`Remove ${person.name}`}>
              <X size={14} strokeWidth={2.2} />
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
