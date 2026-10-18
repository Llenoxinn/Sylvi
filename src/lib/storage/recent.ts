import { createStore, del, get, set } from 'idb-keyval';
import type { Adjust } from '../image/adjust';
import type { Crop, FaceBox } from '../image/crop';
import type { Settings } from './settings';

/**
 * The last jobs a shop printed, kept only on this device so customers' photos
 * never leave it. At most two are kept, and each expires after the window set
 * in Settings.
 */
export interface RecentJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  title: string;
  summary: string;
  thumbnail: Blob;
  /** Set when the shop liked how this job turned out. */
  liked?: boolean;
  people: {
    name: string;
    photo: Blob;
    face: FaceBox | null;
    crops: Record<string, Crop>;
    adjust: Adjust;
    packageId: string;
  }[];
  settings: Pick<Settings, 'paper' | 'cutStyle' | 'exportFormat' | 'calibration'>;
}

export const MAX_RECENT = 2;
const KEY = 'jobs';

let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore('sylvi', 'recent'));

async function readAll(): Promise<RecentJob[]> {
  try {
    return (await get<RecentJob[]>(KEY, db())) ?? [];
  } catch {
    return [];
  }
}

/** Returns jobs that haven't expired, deleting the ones that have. */
export async function listRecent(now = Date.now()): Promise<RecentJob[]> {
  const jobs = await readAll();
  const live = jobs.filter(j => j.expiresAt > now);
  if (live.length !== jobs.length) await writeAll(live);
  return live;
}

export async function saveRecent(job: RecentJob): Promise<RecentJob[]> {
  const jobs = await listRecent();
  const next = [job, ...jobs.filter(j => j.id !== job.id)].slice(0, MAX_RECENT);
  await writeAll(next);
  return next;
}

export async function removeRecent(id: string): Promise<RecentJob[]> {
  const next = (await readAll()).filter(j => j.id !== id);
  await writeAll(next);
  return next;
}

export async function likeRecent(id: string): Promise<RecentJob[]> {
  const next = (await readAll()).map(j => (j.id === id ? { ...j, liked: true } : j));
  await writeAll(next);
  return listRecent();
}

/** Shortens or extends the expiry of stored jobs when the window changes. */
export async function rewindowRecent(hours: number): Promise<RecentJob[]> {
  const jobs = (await readAll()).map(j => ({ ...j, expiresAt: j.createdAt + hours * 3_600_000 }));
  await writeAll(jobs);
  return listRecent();
}

async function writeAll(jobs: RecentJob[]): Promise<void> {
  try {
    if (jobs.length) await set(KEY, jobs, db());
    else await del(KEY, db());
  } catch {
    /* IndexedDB unavailable (private mode); recent jobs just aren't kept */
  }
}
