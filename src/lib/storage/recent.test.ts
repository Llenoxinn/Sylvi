import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_PACKAGES } from '../packages';
import { DEFAULT_SETTINGS } from './settings';
import { likeRecent, listRecent, removeRecent, rewindowRecent, saveRecent, type RecentJob } from './recent';

const database = vi.hoisted(() => ({ value: undefined as unknown, fail: false, queue: Promise.resolve() }));
vi.mock('idb-keyval', () => ({
  createStore: () => ({}),
  get: async () => structuredClone(database.value),
  update: (_key: string, change: (previous: unknown) => unknown) => {
    const result = database.queue.then(() => {
      if (database.fail) throw new Error('database write failed');
      database.value = structuredClone(change(structuredClone(database.value)));
    });
    database.queue = result.catch(() => {});
    return result;
  }
}));

function job(id: string, createdAt = Date.now()): RecentJob {
  return { id, createdAt, expiresAt: createdAt + 86400000, title: id, summary: 'Package A', thumbnail: new Blob(['thumb']),
    people: [{ name: 'Customer', photo: new Blob(['photo']), face: null, crops: {}, adjust: { brightness: 0, contrast: 0, sharpen: 0 }, packageId: 'pkg-a', packageSnapshot: structuredClone(BUILT_IN_PACKAGES[0]) }], settings: structuredClone(DEFAULT_SETTINGS) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  database.value = undefined;
  database.fail = false;
  database.queue = Promise.resolve();
});
afterEach(() => vi.useRealTimers());

describe('recent job transactions', () => {
  it('keeps both jobs when two tabs save at the same time', async () => {
    await Promise.all([saveRecent(job('a')), saveRecent(job('b'))]);
    expect((await listRecent()).map(j => j.id).sort()).toEqual(['a', 'b']);
  });

  it('cannot restore a deleted job when another action writes the list', async () => {
    await saveRecent(job('a'));
    await saveRecent(job('b'));
    await Promise.all([removeRecent('a'), likeRecent('b')]);
    expect((await listRecent()).map(j => j.id)).toEqual(['b']);
    expect((await listRecent())[0].liked).toBe(true);
  });

  it('rejects failed deletion and leaves the stored photos visible for retry', async () => {
    await saveRecent(job('a'));
    database.fail = true;
    await expect(removeRecent('a')).rejects.toThrow('database write failed');
    expect((await listRecent()).map(j => j.id)).toEqual(['a']);
  });

  it('cleans expired photos and does not extend already expired jobs', async () => {
    const expired = job('expired', Date.now() - 2 * 3600000);
    expired.expiresAt = Date.now() - 1;
    database.value = [expired, job('live')];
    expect((await rewindowRecent(168)).map(j => j.id)).toEqual(['live']);
    vi.advanceTimersByTime(169 * 3600000);
    expect(await listRecent()).toEqual([]);
    expect(database.value).toEqual([]);
  });

  it('ignores malformed stored jobs without crashing the screen', async () => {
    database.value = [{ id: 'broken', people: {} }, job('valid')];
    expect((await listRecent()).map(j => j.id)).toEqual(['valid']);
  });
});
