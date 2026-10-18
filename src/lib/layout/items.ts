import type { PhotoPackage } from '../packages';
import type { PackItem } from './pack';

export interface PersonPackage {
  personId: string;
  pkg: PhotoPackage;
}

/**
 * Expands each person's package into individual photos. "Fill" entries become
 * optional photos, interleaved between people so they share leftover space.
 */
export function buildPackItems(people: PersonPackage[], sheetAreaMm2: number): PackItem[] {
  const required: PackItem[] = [];
  const optionalPerPerson: PackItem[][] = [];

  for (const { personId, pkg } of people) {
    const optional: PackItem[] = [];
    pkg.items.forEach((entry, entryIndex) => {
      const count =
        entry.count === 'fill'
          ? Math.floor(sheetAreaMm2 / (entry.size.widthMm * entry.size.heightMm)) + 1
          : Math.max(0, Math.floor(entry.count));
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
