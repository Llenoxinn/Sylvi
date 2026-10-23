import type { PhotoPackage } from '../packages';
import type { PackItem } from './pack';
import { MAX_PACK_ITEMS, MAX_PHOTOS } from '../limits';
import { isPackageItems } from '../packages';

export interface PersonPackage {
  personId: string;
  pkg: PhotoPackage;
}

/**
 * Expands each person's package into individual photos. "Fill" entries become
 * optional photos, interleaved between people so they share leftover space.
 */
export function buildPackItems(people: PersonPackage[], sheetAreaMm2: number): PackItem[] {
  if (!Number.isFinite(sheetAreaMm2) || sheetAreaMm2 <= 0) throw new Error('Choose valid paper dimensions.');
  if (people.length > MAX_PHOTOS) throw new Error(`A job can contain up to ${MAX_PHOTOS} photos.`);
  const required: PackItem[] = [];
  const optionalPerPerson: PackItem[][] = [];
  let total = 0;

  for (const { personId, pkg } of people) {
    if (!isPackageItems(pkg.items) || pkg.deletedAt) throw new Error('This package contains invalid photo sizes or quantities.');
    const optional: PackItem[] = [];
    pkg.items.forEach((entry, entryIndex) => {
      const count =
        entry.count === 'fill'
          ? Math.floor(sheetAreaMm2 / (entry.size.widthMm * entry.size.heightMm)) + 1
          : Math.max(0, Math.floor(entry.count));
      total += count;
      if (!Number.isFinite(total) || total > MAX_PACK_ITEMS) {
        throw new Error(`This layout exceeds ${MAX_PACK_ITEMS} copies. Use larger photo sizes, smaller paper, or fewer customers.`);
      }
      for (let n = 0; n < count; n++) {
        const item: PackItem = {
          id: `${personId}:${entryIndex}:${n}`,
          personId,
          size: entry.size,
          optional: entry.count === 'fill'
        };
        (item.optional ? optional : required).push(item);
      }
    });
    optionalPerPerson.push(optional);
  }

  const longest = Math.max(0, ...optionalPerPerson.map(list => list.length));
  const interleaved: PackItem[] = [];
  for (let i = 0; i < longest; i++) {
    for (const list of optionalPerPerson) if (list[i]) interleaved.push(list[i]);
  }
  return [...required, ...interleaved];
}
