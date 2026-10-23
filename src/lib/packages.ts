import { isPhotoSize, PHOTO_SIZES, type PhotoSize } from './sizes';
import { MAX_COPIES, MAX_PACKAGE_ITEMS } from './limits';

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
  deletedAt?: number;
}

export function isPhotoPackage(value: unknown): value is PhotoPackage {
  if (!value || typeof value !== 'object') return false;
  const p = value as PhotoPackage;
  return typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 100 &&
    typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 60 && !p.name.includes('\0') &&
    Number.isFinite(p.updatedAt) && p.updatedAt >= 0 &&
    (p.deletedAt === undefined || (Number.isFinite(p.deletedAt) && p.deletedAt > 0)) &&
    isPackageItems(p.items);
}

export function isPackageItems(value: unknown): value is PackageItem[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_PACKAGE_ITEMS &&
    value.every(i => i && isPhotoSize(i.size) &&
      (i.count === 'fill' || (Number.isInteger(i.count) && i.count >= 1 && i.count <= MAX_COPIES)));
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

/** A deletion wins over any live copy, including stale uploads from another computer. */
export function mergePackages(local: PhotoPackage[], remote: PhotoPackage[]): { merged: PhotoPackage[]; toUpload: PhotoPackage[] } {
  const byId = new Map(remote.map(p => [p.id, p]));
  const toUpload: PhotoPackage[] = [];
  for (const pkg of local) {
    const other = byId.get(pkg.id);
    if (other?.deletedAt && !pkg.deletedAt) continue;
    if (!other || (pkg.deletedAt && !other.deletedAt) || pkg.updatedAt > other.updatedAt) {
      byId.set(pkg.id, pkg);
      toUpload.push(pkg);
    }
  }
  return { merged: [...byId.values()], toUpload };
}
