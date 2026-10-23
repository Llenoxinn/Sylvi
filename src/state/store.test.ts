import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_PACKAGES, type PhotoPackage } from '../lib/packages';
import { DEFAULT_SETTINGS } from '../lib/storage/settings';
import type { RecentJob } from '../lib/storage/recent';
import type { useStore as StoreHook } from './store';
import * as cloud from '../lib/cloud';
import * as recent from '../lib/storage/recent';
import * as photos from '../lib/image/load';

vi.mock('../lib/cloud', () => ({ fetchPackages: vi.fn(), fetchSettings: vi.fn(), upsertPackage: vi.fn(), pushSettings: vi.fn() }));
vi.mock('../lib/storage/recent', () => ({ listRecent: vi.fn(), saveRecent: vi.fn(), removeRecent: vi.fn(), likeRecent: vi.fn(), rewindowRecent: vi.fn() }));
vi.mock('../lib/image/face', () => ({ detectFace: vi.fn(async () => null) }));
vi.mock('../lib/image/load', () => ({ PhotoError: class extends Error {}, loadPhoto: vi.fn(async (blob: Blob) => ({ bitmap: { width: 320, height: 320, close: vi.fn() }, blob, width: 320, height: 320 })) }));

let store: typeof StoreHook;
let data: Map<string, string>;
const a = { id: 'account-a', email: 'a@example.test' };
const b = { id: 'account-b', email: 'b@example.test' };
const pkg = (): PhotoPackage => ({ ...structuredClone(BUILT_IN_PACKAGES[0]), id: 'custom-a', builtIn: false, updatedAt: Date.now() });

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.mocked(cloud.fetchPackages).mockResolvedValue([]);
  vi.mocked(cloud.fetchSettings).mockResolvedValue(null);
  vi.mocked(cloud.upsertPackage).mockResolvedValue(undefined);
  vi.mocked(cloud.pushSettings).mockResolvedValue(undefined);
  vi.mocked(recent.listRecent).mockResolvedValue([]);
  vi.mocked(recent.rewindowRecent).mockResolvedValue([]);
  ({ useStore: store } = await import('./store'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('account sync', () => {
  it('never uploads the previous account’s shop details into a different account', async () => {
    await store.getState().setAccount(a);
    store.getState().updateSettings({ shopName: 'Shop A', shopPhone: '09170000000' });
    await store.getState().syncAccount();
    await store.getState().setAccount(null);
    expect(store.getState().settings.shopName).toBe('');
    await store.getState().setAccount(b);
    expect(store.getState().settings.shopPhone).toBe('');
    expect(vi.mocked(cloud.pushSettings).mock.calls.filter(([, id]) => id === b.id).every(([settings]) => settings.shopName === '')).toBe(true);
    await store.getState().setAccount(a);
    expect(store.getState().settings.shopName).toBe('Shop A');
  });

  it('discards an account A response after account B has signed in', async () => {
    let finish!: (value: PhotoPackage[]) => void;
    vi.mocked(cloud.fetchPackages).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = store.getState().setAccount(a);
    await store.getState().setAccount(b);
    finish([pkg()]);
    await pending;
    expect(store.getState().account?.id).toBe(b.id);
    expect(store.getState().customPackages).toEqual([]);
    expect(cloud.upsertPackage).not.toHaveBeenCalled();
  });

  it('retries a failed sync for the same account and clears the error after success', async () => {
    vi.mocked(cloud.fetchPackages).mockRejectedValueOnce(new Error('offline'));
    await store.getState().setAccount(a);
    expect(store.getState().syncError).toBe('offline');
    expect(store.getState().syncing).toBe(false);
    await store.getState().setAccount(a);
    expect(cloud.fetchPackages).toHaveBeenCalledTimes(2);
    expect(store.getState().syncError).toBe(null);
  });

  it('keeps deletion records and uploads them instead of forgetting an offline deletion', async () => {
    await store.getState().setAccount(a);
    store.getState().savePackage(pkg());
    store.getState().deletePackage('custom-a');
    await store.getState().syncAccount();
    expect(store.getState().customPackages[0].deletedAt).toBeGreaterThan(0);
    expect(cloud.upsertPackage).toHaveBeenCalledWith(expect.objectContaining({ id: 'custom-a', deletedAt: expect.any(Number) }), a.id);
    const { allPackages } = await import('./store');
    expect(allPackages(store.getState().customPackages).some(p => p.id === 'custom-a')).toBe(false);
  });

  it('includes edits made while an earlier sync request is in flight', async () => {
    await store.getState().setAccount(a);
    store.getState().savePackage(pkg());
    let release!: () => void;
    vi.mocked(cloud.upsertPackage).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = store.getState().syncAccount();
    await Promise.resolve();
    await Promise.resolve();
    store.getState().updateSettings({ shopName: 'Latest name' });
    release();
    await pending;
    expect(cloud.pushSettings).toHaveBeenLastCalledWith(expect.objectContaining({ shopName: 'Latest name' }), a.id);
    expect(store.getState().syncError).toBe(null);
  });

  it('does not change the cloud settings version for a device-only theme change', async () => {
    await store.getState().setAccount(a);
    const updatedAt = store.getState().settings.updatedAt;
    const calls = vi.mocked(cloud.pushSettings).mock.calls.length;
    store.getState().updateSettings({ theme: 'dark' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(store.getState().settings.updatedAt).toBe(updatedAt);
    expect(cloud.pushSettings).toHaveBeenCalledTimes(calls);
  });

  it('reports a local package save failure without claiming it was saved', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
    expect(store.getState().savePackage(pkg())).toBe(false);
    expect(store.getState().toasts.at(-1)?.message).toContain('couldn’t save');
  });
});

describe('recent-job actions', () => {
  const savedJob = (): RecentJob => ({ id: 'job', createdAt: Date.now(), expiresAt: Date.now() + 86400000, title: 'Customer', summary: 'Saved package', thumbnail: new Blob(['thumb']),
    people: [{ name: 'Customer', photo: new Blob(['photo']), face: null, crops: {}, adjust: { brightness: 0, contrast: 0, sharpen: 0 }, packageId: 'custom-a', packageSnapshot: pkg() }], settings: structuredClone(DEFAULT_SETTINGS) });

  it('keeps a photo job on screen when its deletion failed', async () => {
    const job = savedJob();
    store.setState({ recent: [job] });
    vi.mocked(recent.removeRecent).mockRejectedValueOnce(new Error('quota'));
    await store.getState().forgetJob(job.id);
    expect(store.getState().recent).toEqual([job]);
    expect(store.getState().toasts.at(-1)?.message).toContain('still stored');
  });

  it('reopens the saved package contents after the original package was deleted', async () => {
    const job = savedJob();
    await store.getState().reopenJob(job);
    const person = store.getState().people[0];
    expect(person.packageId).toBe('custom-a');
    expect(person.packageSnapshot?.items).toEqual(job.people[0].packageSnapshot?.items);
    store.getState().savePackage({ ...pkg(), items: BUILT_IN_PACKAGES[1].items });
    expect(person.packageSnapshot?.items).toEqual(BUILT_IN_PACKAGES[0].items);
  });

  it('rejects an expired recent job without loading its photos', async () => {
    const job = savedJob();
    job.expiresAt = Date.now() - 1;
    await store.getState().reopenJob(job);
    expect(store.getState().people).toEqual([]);
    expect(store.getState().toasts.at(-1)?.message).toContain('expired');
  });

  it('keeps the current sheet if export starts while a recent photo is loading', async () => {
    let finish!: (photo: photos.LoadedPhoto) => void;
    vi.mocked(photos.loadPhoto).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = store.getState().reopenJob(savedJob());
    store.getState().setBusy('export');
    const close = vi.fn();
    finish({ bitmap: { width: 320, height: 320, close } as unknown as ImageBitmap, width: 320, height: 320, blob: new Blob(['photo']) });
    await pending;
    expect(store.getState().people).toEqual([]);
    expect(store.getState().busy).toBe('export');
    expect(close).toHaveBeenCalledOnce();
  });
});
