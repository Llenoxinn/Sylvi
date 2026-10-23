import type { ExportFormat } from '../export/formats';
import type { CutStyle } from '../layout/guides';
import { isPhotoPackage, type PhotoPackage } from '../packages';
import type { PaperSetup } from '../papers';
import { MAX_PAPER_MM } from '../limits';
import type { Unit } from '../units';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  paper: PaperSetup;
  cutStyle: CutStyle;
  exportFormat: ExportFormat;
  calibration: boolean;
  unit: Unit;
  /** How long recent jobs are kept on this device. */
  recentHours: number;
  theme: Theme;
  defaultPackageId: string;
  shopName: string;
  shopPhone: string;
  shopCity: string;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  paper: { paperId: '4r', customWidthMm: 101.6, customHeightMm: 152.4, orientation: 'auto', marginMm: 0 },
  cutStyle: 'marks',
  exportFormat: 'pdf',
  calibration: true,
  unit: 'in',
  recentHours: 24,
  theme: 'system',
  defaultPackageId: 'pkg-b',
  shopName: '',
  shopPhone: '',
  shopCity: '',
  updatedAt: 0
};

export const RECENT_WINDOWS: { hours: number; label: string }[] = [
  { hours: 1, label: '1 hour' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 24 * 7, label: '7 days' }
];

const keyFor = (kind: string, userId: string | null) => `sylvi:${userId ? `user:${userId}` : 'guest'}:${kind}`;

// localStorage can throw (private mode, blocked storage); Sylvi still works,
// it just won't remember anything between visits.
function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function sanitizeSettings(value: unknown): Settings {
  const saved = value && typeof value === 'object' ? value as Partial<Settings> : {};
  const paper = saved.paper && typeof saved.paper === 'object' ? saved.paper : DEFAULT_SETTINGS.paper;
  const number = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  const text = (v: unknown, max: number, fallback = '') => typeof v === 'string' ? v.replaceAll('\0', '').slice(0, max) : fallback;
  return {
    paper: {
      paperId: ['3r', '4r', '5r', 'a4', 'short', 'long', 'custom'].includes(paper.paperId) ? paper.paperId : '4r',
      customWidthMm: number(paper.customWidthMm, DEFAULT_SETTINGS.paper.customWidthMm, 20, MAX_PAPER_MM),
      customHeightMm: number(paper.customHeightMm, DEFAULT_SETTINGS.paper.customHeightMm, 20, MAX_PAPER_MM),
      marginMm: number(paper.marginMm, 0, 0, MAX_PAPER_MM / 2),
      orientation: ['auto', 'portrait', 'landscape'].includes(paper.orientation) ? paper.orientation : 'auto'
    },
    cutStyle: ['marks', 'lines', 'spaced'].includes(saved.cutStyle ?? '') ? saved.cutStyle! : DEFAULT_SETTINGS.cutStyle,
    exportFormat: ['pdf', 'png', 'jpg'].includes(saved.exportFormat ?? '') ? saved.exportFormat! : 'pdf',
    calibration: typeof saved.calibration === 'boolean' ? saved.calibration : true,
    unit: saved.unit === 'mm' ? 'mm' : 'in',
    recentHours: RECENT_WINDOWS.some(w => w.hours === saved.recentHours) ? saved.recentHours! : 24,
    theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : 'system',
    defaultPackageId: text(saved.defaultPackageId, 100, 'pkg-b'),
    shopName: text(saved.shopName, 60),
    shopPhone: text(saved.shopPhone, 20),
    shopCity: text(saved.shopCity, 60),
    updatedAt: number(saved.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER)
  };
}

export function loadSettings(userId: string | null = null): Settings {
  // Old unscoped shop data has no proven owner. Keep it for recovery, never import it into another account.
  const settings = sanitizeSettings(read(keyFor('settings', userId)));
  const theme = read('sylvi:theme');
  return { ...settings, theme: theme === 'light' || theme === 'dark' ? theme : 'system' };
}

export function saveSettings(settings: Settings, userId: string | null = null): void {
  write(keyFor('settings', userId), settings);
  write('sylvi:theme', settings.theme);
}

export function loadCustomPackages(userId: string | null = null): PhotoPackage[] {
  const value = read(keyFor('packages', userId));
  return Array.isArray(value) ? value.filter(isPhotoPackage).map(p => ({ ...p, builtIn: false })) : [];
}

export const saveCustomPackages = (packages: PhotoPackage[], userId: string | null = null) => write(keyFor('packages', userId), packages);
