import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_PACKAGES } from '../packages';
import { DEFAULT_SETTINGS, loadCustomPackages, loadSettings, sanitizeSettings, saveCustomPackages, saveSettings } from './settings';

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('account caches', () => {
  it('keeps account A, account B, and guest shop data separate', () => {
    saveSettings({ ...DEFAULT_SETTINGS, shopName: 'Shop A', shopPhone: '09170000000', theme: 'dark' }, 'a');
    saveCustomPackages([{ ...BUILT_IN_PACKAGES[0], id: 'custom-a', builtIn: false }], 'a');
    expect(loadSettings('b').shopName).toBe('');
    expect(loadSettings().shopPhone).toBe('');
    expect(loadCustomPackages('b')).toEqual([]);
    expect(loadCustomPackages()).toEqual([]);
    expect(loadSettings('a').shopPhone).toBe('09170000000');
    expect(loadCustomPackages('a')).toHaveLength(1);
    expect(loadSettings('b').theme).toBe('dark');
  });

  it('preserves legacy data without assigning an unknown owner', () => {
    const legacy = JSON.stringify({ ...DEFAULT_SETTINGS, shopName: 'Previous shop' });
    data.set('sylvi:settings', legacy);
    data.set('sylvi:packages', JSON.stringify([BUILT_IN_PACKAGES[0]]));
    expect(loadSettings().shopName).toBe('');
    expect(loadSettings('new-account').shopName).toBe('');
    expect(loadCustomPackages('new-account')).toEqual([]);
    expect(data.get('sylvi:settings')).toBe(legacy);
  });

  it('rejects malformed records and unsafe settings before rendering', () => {
    data.set('sylvi:guest:packages', JSON.stringify([{ id: 'broken', items: {} }]));
    expect(loadCustomPackages()).toEqual([]);
    data.set('sylvi:guest:packages', '{}');
    expect(loadCustomPackages()).toEqual([]);
    const settings = sanitizeSettings({ paper: { paperId: 'custom', customWidthMm: Infinity, customHeightMm: 100000 }, cutStyle: 'bad', shopName: null, recentHours: Infinity });
    expect(settings.paper.customWidthMm).toBe(DEFAULT_SETTINGS.paper.customWidthMm);
    expect(settings.paper.customHeightMm).toBe(DEFAULT_SETTINGS.paper.customHeightMm);
    expect(settings.cutStyle).toBe('marks');
    expect(settings.shopName).toBe('');
    expect(settings.recentHours).toBe(24);
  });

  it('reports failed persistence instead of pretending settings were saved', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota'); } });
    expect(() => saveSettings(DEFAULT_SETTINGS, 'a')).toThrow('quota');
  });
});
