import type { ExportFormat } from '../export/formats';
import type { CutStyle } from '../layout/guides';
import type { PhotoPackage } from '../packages';
import type { PaperSetup } from '../papers';
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

const SETTINGS_KEY = 'sylvi:settings';
const PACKAGES_KEY = 'sylvi:packages';

// localStorage can throw (private mode, blocked storage); Sylvi still works,
// it just won't remember anything between visits.
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function loadSettings(): Settings {
  const saved = read<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...saved, paper: { ...DEFAULT_SETTINGS.paper, ...saved?.paper } };
}

export const saveSettings = (settings: Settings) => write(SETTINGS_KEY, settings);

export const loadCustomPackages = (): PhotoPackage[] => read<PhotoPackage[]>(PACKAGES_KEY) ?? [];

export const saveCustomPackages = (packages: PhotoPackage[]) => write(PACKAGES_KEY, packages);
