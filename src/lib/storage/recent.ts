import { createStore, get, update } from 'idb-keyval';
import type { Adjust } from '../image/adjust';
import type { Crop, FaceBox } from '../image/crop';
import type { Settings } from './settings';
import { RECENT_WINDOWS } from './settings';
import { isPhotoPackage, type PhotoPackage } from '../packages';
import { MAX_PHOTOS } from '../limits';

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
    packageSnapshot?: PhotoPackage;
  }[];
  settings: Pick<Settings, 'paper' | 'cutStyle' | 'exportFormat' | 'calibration'>;
}

export const MAX_RECENT = 2;
const KEY = 'jobs';

let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore('sylvi', 'recent'));

export function isRecentJob(value: unknown): value is RecentJob {
  if (!value || typeof value !== 'object') return false;
  const job = value as RecentJob;
  return typeof job.id === 'string' && Number.isFinite(job.createdAt) && Number.isFinite(job.expiresAt) &&
    typeof job.title === 'string' && typeof job.summary === 'string' && job.thumbnail instanceof Blob &&
    !!job.settings && typeof job.settings === 'object' && Array.isArray(job.people) &&
    job.people.length > 0 && job.people.length <= MAX_PHOTOS && job.people.every(p =>
      p && typeof p.name === 'string' && typeof p.packageId === 'string' && p.photo instanceof Blob &&
      !!p.crops && typeof p.crops === 'object' && Object.values(p.crops).every(c => c &&
        [c.cx, c.cy, c.h].every(Number.isFinite) && c.h > 0 && c.cx >= 0 && c.cx <= 1 && c.cy >= 0 && c.cy <= 1) &&
      !!p.adjust && [p.adjust.brightness, p.adjust.contrast, p.adjust.sharpen, p.adjust.saturation ?? 0, p.adjust.warmth ?? 0].every(Number.isFinite) &&
      (p.face === null || !!p.face && [p.face.x, p.face.y, p.face.w, p.face.h].every(Number.isFinite)) &&
      (!p.packageSnapshot || isPhotoPackage(p.packageSnapshot) && !p.packageSnapshot.deletedAt));
}

const liveJobs = (value: unknown, now: number): RecentJob[] =>
  Array.isArray(value) ? value.filter(isRecentJob).filter(j => j.expiresAt > now).slice(0, MAX_RECENT) : [];

async function changeJobs(change: (jobs: RecentJob[]) => RecentJob[], now = Date.now()): Promise<RecentJob[]> {
  let next: RecentJob[] = [];
  await update<RecentJob[]>(KEY, previous => {
    next = change(liveJobs(previous, now));
    return next;
  }, db());
  return next;
}

/** Expired copies are cleaned while the app is running or on its next launch. */
export async function listRecent(now = Date.now()): Promise<RecentJob[]> {
  const jobs = await get<unknown>(KEY, db());
  const live = liveJobs(jobs, now);
  if (jobs !== undefined && (!Array.isArray(jobs) || live.length !== jobs.length)) return changeJobs(j => j, now);
  return live;
}

export async function saveRecent(job: RecentJob): Promise<RecentJob[]> {
  if (!isRecentJob(job) || job.expiresAt <= Date.now()) throw new Error('Invalid or expired recent job.');
  return changeJobs(jobs => [job, ...jobs.filter(j => j.id !== job.id)].slice(0, MAX_RECENT));
}

export async function removeRecent(id: string): Promise<RecentJob[]> {
  return changeJobs(jobs => jobs.filter(j => j.id !== id));
}

export async function likeRecent(id: string): Promise<RecentJob[]> {
  return changeJobs(jobs => jobs.map(j => j.id === id ? { ...j, liked: true } : j));
}

/** Shortens or extends the expiry of stored jobs when the window changes. */
export async function rewindowRecent(hours: number): Promise<RecentJob[]> {
  if (!RECENT_WINDOWS.some(w => w.hours === hours)) throw new Error('Invalid retention window.');
  const now = Date.now();
  return changeJobs(jobs => jobs.map(j => ({ ...j, expiresAt: j.createdAt + hours * 3_600_000 })).filter(j => j.expiresAt > now), now);
}
