import { PHOTO_SIZES, type PhotoSize } from './sizes';

export interface PackageItem {
  size: PhotoSize;
  /** Number of copies, or 'fill' to fill whatever space is left on the sheet. */
  count: number | 'fill';
}

export interface PhotoPackage {
  id: string;
  name: string;
  items: PackageItem[];
  builtIn?: boolean;
  updatedAt: number;
}

const size = (key: string) => PHOTO_SIZES.find(s => s.key === key)!;

// Starter packages mirror the menus PH print shops already advertise.
export const BUILT_IN_PACKAGES: PhotoPackage[] = [
  { id: 'pkg-a', name: 'Package A', builtIn: true, updatedAt: 0, items: [{ size: size('2x2'), count: 2 }, { size: size('1x1'), count: 7 }] },
  { id: 'pkg-b', name: 'Package B', builtIn: true, updatedAt: 0, items: [{ size: size('2x2'), count: 4 }, { size: size('1x1'), count: 8 }] },
  { id: 'pkg-c', name: 'Package C', builtIn: true, updatedAt: 0, items: [{ size: size('passport'), count: 4 }, { size: size('1x1'), count: 6 }] },
  { id: 'pkg-d', name: 'Package D', builtIn: true, updatedAt: 0, items: [{ size: size('passport'), count: 8 }] },
  { id: 'pkg-full-1x1', name: 'Whole sheet 1x1', builtIn: true, updatedAt: 0, items: [{ size: size('1x1'), count: 'fill' }] },
  { id: 'pkg-full-2x2', name: 'Whole sheet 2x2', builtIn: true, updatedAt: 0, items: [{ size: size('2x2'), count: 'fill' }] }
];

/** "4 × 2x2, 8 × 1x1" */
export function describePackage(pkg: PhotoPackage): string {
  return pkg.items.map(i => (i.count === 'fill' ? `${i.size.label} to fill the sheet` : `${i.count} × ${i.size.label}`)).join(', ');
}
