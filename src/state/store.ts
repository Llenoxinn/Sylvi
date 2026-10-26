import { create } from 'zustand';
import * as cloud from '../lib/cloud';
import { NO_ADJUST, type Adjust } from '../lib/image/adjust';
import type { Crop } from '../lib/image/crop';
import { detectFace } from '../lib/image/face';
import { loadPhoto, PhotoError } from '../lib/image/load';
import { BUILT_IN_PACKAGES, isPhotoPackage, mergePackages, type PhotoPackage } from '../lib/packages';
import { MAX_PHOTOS } from '../lib/limits';
import type { Person } from '../lib/person';
import { likeRecent, listRecent, removeRecent, rewindowRecent, saveRecent, type RecentJob } from '../lib/storage/recent';
import {
  loadCustomPackages,
  loadSettings,
  saveCustomPackages,
  saveSettings,
  sanitizeSettings,
  type Settings
} from '../lib/storage/settings';

export type Panel = 'recent' | 'packages' | 'settings' | null;

export interface Toast {
  id: number;
  tone: 'info' | 'success' | 'error';
  message: string;
}

interface State {
  people: Person[];
  activeId: string | null;
  settings: Settings;
  customPackages: PhotoPackage[];
  recent: RecentJob[];
  panel: Panel;
  cropEditorFor: string | null;
  toasts: Toast[];
  account: { id: string; email: string } | null;
  syncing: boolean;
  syncError: string | null;
  busy: 'export' | 'print' | null;
  /** The job just downloaded or printed, offered for a like until the shop moves on. */
  doneJobId: string | null;
}

interface Actions {
  addPhotos(files: File[]): Promise<void>;
  removePerson(id: string): void;
  setActive(id: string): void;
  renamePerson(id: string, name: string): void;
  setPersonPackage(id: string, packageId: string): void;
  setCrop(id: string, aspect: string, crop: Crop | null): void;
  setAdjust(id: string, adjust: Partial<Adjust>): void;
  resetAdjust(id: string): void;
  clearAll(): void;

  updateSettings(patch: Partial<Settings>): void;
  savePackage(pkg: PhotoPackage): boolean;
  deletePackage(id: string): void;

  refreshRecent(): Promise<void>;
  rememberJob(job: RecentJob): Promise<void>;
  reopenJob(job: RecentJob): Promise<void>;
  forgetJob(id: string): Promise<void>;
  likeJob(id: string): Promise<void>;
  dismissDone(): void;

  openPanel(panel: Panel): void;
  openCropEditor(id: string | null): void;
  toast(message: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
  setBusy(busy: State['busy']): void;
  setAccount(account: State['account']): Promise<void>;
  syncAccount(): Promise<void>;
}

export type Store = State & Actions;

let toastSeq = 0;
const newId = () => crypto.randomUUID();

export function allPackages(custom: PhotoPackage[]): PhotoPackage[] {
  return [...BUILT_IN_PACKAGES, ...custom.filter(p => !p.deletedAt)];
}

export function findPackage(custom: PhotoPackage[], id: string, snapshot?: PhotoPackage): PhotoPackage {
  return snapshot ?? allPackages(custom).find(p => p.id === id) ?? BUILT_IN_PACKAGES[1];
}

let settingsPush: ReturnType<typeof setTimeout> | undefined;
let accountGeneration = 0;
let changes = 0;
let recentGeneration = 0;
let photoGeneration = 0;
let syncingTask: { generation: number; promise: Promise<void> } | null = null;

function persistLocal() {
  const state = useStore.getState();
  try {
    saveSettings(state.settings, state.account?.id ?? null);
    saveCustomPackages(state.customPackages, state.account?.id ?? null);
    return true;
  } catch {
    state.toast('Browser storage couldn’t save these changes. They stay in this tab until storage works or account sync succeeds.', 'error');
    return false;
  }
}

function scheduleSync() {
  changes++;
  if (!useStore.getState().account) return;
  useStore.setState({ syncing: true, syncError: null });
  clearTimeout(settingsPush);
  settingsPush = setTimeout(() => void useStore.getState().syncAccount(), 1200);
}

export const useStore = create<Store>((set, get) => ({
  people: [],
  activeId: null,
  settings: loadSettings(),
  customPackages: loadCustomPackages(),
  recent: [],
  panel: null,
  cropEditorFor: null,
  toasts: [],
  account: null,
  syncing: false,
  syncError: null,
  busy: null,
  doneJobId: null,

  async addPhotos(files) {
    if (get().busy) return;
    const generation = photoGeneration;
    if (files.length) set({ doneJobId: null }); // new work: the last job is behind us
    for (const file of files) {
      if (generation !== photoGeneration || get().busy) return;
      if (get().people.length >= MAX_PHOTOS) {
        get().toast(`A job can contain up to ${MAX_PHOTOS} photos. Finish this job before adding more.`, 'error');
        break;
      }
      try {
        const photo = await loadPhoto(file, file.name);
        if (generation !== photoGeneration || get().busy || get().people.length >= MAX_PHOTOS) {
          photo.bitmap.close();
          return;
        }
        const { settings, customPackages, people } = get();
        const packageId = findPackage(customPackages, settings.defaultPackageId).id;
        const person: Person = {
          id: newId(),
          name: defaultName(file.name, people.length),
          photo,
          face: null,
          faceStatus: 'looking',
          crops: {},
          adjust: { ...NO_ADJUST },
          packageId
        };
        set(s => ({ people: [...s.people, person], activeId: person.id }));
        void findFace(person.id);
      } catch (error) {
        get().toast(error instanceof PhotoError ? error.message : 'That photo couldn’t be added. Try a JPG or PNG.', 'error');
      }
    }
  },

  removePerson(id) {
    if (get().busy) return;
    const person = get().people.find(p => p.id === id);
    person?.photo.bitmap.close();
    set(s => {
      const people = s.people.filter(p => p.id !== id);
      const activeId = s.activeId === id ? (people.at(-1)?.id ?? null) : s.activeId;
      return { people, activeId, cropEditorFor: s.cropEditorFor === id ? null : s.cropEditorFor };
    });
  },

  setActive: id => set({ activeId: id }),

  renamePerson: (id, name) => set(s => ({ people: patchPerson(s.people, id, { name }) })),

  setPersonPackage(id, packageId) {
    set(s => ({ people: patchPerson(s.people, id, { packageId, packageSnapshot: undefined }) }));
    // The next photo starts with the package the shop used last.
    get().updateSettings({ defaultPackageId: packageId });
  },

  setCrop(id, aspect, crop) {
    set(s => ({
      people: s.people.map(p => {
        if (p.id !== id) return p;
        const crops = { ...p.crops };
        if (crop) crops[aspect] = crop;
        else delete crops[aspect];
        return { ...p, crops };
      })
    }));
  },

  setAdjust: (id, adjust) =>
    set(s => ({ people: s.people.map(p => (p.id === id ? { ...p, adjust: { ...p.adjust, ...adjust } } : p)) })),

  resetAdjust: id => set(s => ({ people: patchPerson(s.people, id, { adjust: { ...NO_ADJUST } }) })),

  clearAll() {
    if (get().busy) return;
    photoGeneration++;
    get().people.forEach(p => p.photo.bitmap.close());
    set({ people: [], activeId: null, cropEditorFor: null, doneJobId: null });
  },

  updateSettings(patch) {
    const before = get().settings;
    const themeOnly = Object.keys(patch).every(key => key === 'theme');
    const settings = sanitizeSettings({ ...before, ...patch, updatedAt: themeOnly ? before.updatedAt : Date.now() });
    set({ settings });
    persistLocal();
    if (settings.recentHours !== before.recentHours) {
      void rewindowRecent(settings.recentHours).then(() => get().refreshRecent()).catch(() => get().toast('The photo retention change couldn’t be saved. Try again.', 'error'));
    }
    if (!themeOnly) scheduleSync();
  },

  savePackage(pkg) {
    if (!isPhotoPackage(pkg) || BUILT_IN_PACKAGES.some(p => p.id === pkg.id)) {
      get().toast('That package contains invalid sizes or quantities.', 'error');
      return false;
    }
    const saved = { ...pkg, builtIn: false, updatedAt: Date.now() };
    const exists = get().customPackages.some(p => p.id === saved.id);
    const customPackages = exists
      ? get().customPackages.map(p => (p.id === saved.id ? saved : p))
      : [...get().customPackages, saved];
    set({ customPackages });
    const persisted = persistLocal();
    scheduleSync();
    return persisted;
  },

  deletePackage(id) {
    const now = Date.now();
    const customPackages = get().customPackages.map(p => p.id === id ? { ...p, deletedAt: now, updatedAt: now } : p);
    const fallback = get().settings.defaultPackageId === id ? BUILT_IN_PACKAGES[1].id : get().settings.defaultPackageId;
    set(s => ({
      customPackages,
      people: s.people.map(p => (p.packageId === id ? { ...p, packageId: fallback } : p))
    }));
    persistLocal();
    if (fallback !== get().settings.defaultPackageId) get().updateSettings({ defaultPackageId: fallback });
    scheduleSync();
  },

  async refreshRecent() {
    const generation = recentGeneration;
    try {
      const recent = await listRecent();
      if (generation === recentGeneration) set({ recent });
    } catch {
      get().toast('Recent jobs couldn’t be read or cleaned up. Customer photos may still be stored.', 'error');
    }
  },

  async rememberJob(job) {
    recentGeneration++;
    try {
      await saveRecent(job);
      await get().refreshRecent();
      set({ doneJobId: job.id });
    } catch {
      get().toast('The file was created, but this job couldn’t be saved for reprinting.', 'error');
    }
  },

  async reopenJob(job) {
    if (get().busy) return;
    if (job.expiresAt <= Date.now()) {
      get().toast('This job has expired and can’t be reopened.', 'error');
      await get().refreshRecent();
      return;
    }
    const generation = photoGeneration;
    const people: Person[] = [];
    try {
      for (const saved of job.people) {
        const pkg = saved.packageSnapshot ?? allPackages(get().customPackages).find(p => p.id === saved.packageId);
        if (!pkg) throw new Error('This older job has no saved package, and its original package was deleted.');
        const photo = await loadPhoto(saved.photo);
        people.push({
          id: newId(),
          name: saved.name,
          photo,
          face: saved.face,
          faceStatus: saved.face ? 'found' : 'none',
          crops: saved.crops,
          adjust: saved.adjust,
          packageId: pkg.id,
          packageSnapshot: structuredClone(pkg)
        });
      }
      if (generation !== photoGeneration || get().busy) {
        people.forEach(p => p.photo.bitmap.close());
        return;
      }
      get().clearAll();
      set({ people, activeId: people[0]?.id ?? null, panel: null });
      get().updateSettings({ ...job.settings, paper: { ...job.settings.paper } });
      get().toast(job.people.some(p => !p.packageSnapshot) ? 'Older job reopened using current packages. Check sizes before printing.' : `Reopened ${job.title}.`, 'info');
    } catch (error) {
      people.forEach(p => p.photo.bitmap.close());
      get().toast(error instanceof Error ? error.message : 'This job couldn’t be reopened. Your current sheet was kept.', 'error');
    }
  },

  async forgetJob(id) {
    recentGeneration++;
    try {
      await removeRecent(id);
      set(s => ({ doneJobId: s.doneJobId === id ? null : s.doneJobId }));
      await get().refreshRecent();
    } catch {
      get().toast('Deletion failed. These customer photos are still stored. Try deleting the job again.', 'error');
    }
  },

  async likeJob(id) {
    recentGeneration++;
    try {
      await likeRecent(id);
      await get().refreshRecent();
    } catch {
      get().toast('The like couldn’t be saved.', 'error');
    }
  },

  dismissDone: () => set({ doneJobId: null }),

  openPanel: panel => set({ panel }),
  openCropEditor: id => set({ cropEditorFor: id }),

  toast(message, tone = 'info') {
    const id = ++toastSeq;
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, tone, message }] }));
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 7000 : 4000);
  },

  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setBusy: busy => set({ busy }),

  async setAccount(account) {
    if (get().account?.id === account?.id) {
      if (account) set({ account });
      return get().syncAccount();
    }
    accountGeneration++;
    photoGeneration++;
    clearTimeout(settingsPush);
    const previousPeople = get().people;
    if (get().busy) {
      const unsubscribe = useStore.subscribe(state => {
        if (!state.busy) {
          unsubscribe();
          previousPeople.forEach(p => p.photo.bitmap.close());
        }
      });
    } else previousPeople.forEach(p => p.photo.bitmap.close());
    set({ account, settings: loadSettings(account?.id ?? null), customPackages: loadCustomPackages(account?.id ?? null),
      people: [], activeId: null, cropEditorFor: null, doneJobId: null, syncing: false, syncError: null });
    if (account) await get().syncAccount();
  },

  async syncAccount() {
    const account = get().account;
    if (!account) return;
    const generation = accountGeneration;
    if (syncingTask?.generation === generation) return syncingTask.promise;
    clearTimeout(settingsPush);
    const current = () => generation === accountGeneration && get().account?.id === account.id;
    const promise = (async () => {
      set({ syncing: true, syncError: null });
      try {
        let revision: number;
        do {
          revision = changes;
          const [remotePackages, remoteSettings] = await Promise.all([cloud.fetchPackages(account.id), cloud.fetchSettings(account.id)]);
          if (!current()) return;
          const { merged, toUpload } = mergePackages(get().customPackages, remotePackages);
          set({ customPackages: merged });
          persistLocal();
          await Promise.all(toUpload.map(pkg => cloud.upsertPackage(pkg, account.id)));
          if (!current()) return;
          const local = get().settings;
          if (remoteSettings && remoteSettings.updatedAt > local.updatedAt) {
            const settings = sanitizeSettings({ ...remoteSettings, theme: local.theme });
            set({ settings });
            persistLocal();
            if (settings.recentHours !== local.recentHours) {
              await rewindowRecent(settings.recentHours);
              if (!current()) return;
              await get().refreshRecent();
            }
          } else {
            await cloud.pushSettings(local, account.id);
          }
          if (!current()) return;
        } while (revision !== changes);
      } catch (error) {
        if (!current()) return;
        const message = error instanceof Error ? error.message : 'The connection failed.';
        set({ syncError: message });
        get().toast('Changes haven’t synced. Reconnect or use Retry sync in Settings.', 'error');
      } finally {
        if (current()) {
          clearTimeout(settingsPush);
          set({ syncing: false });
        }
      }
    })();
    syncingTask = { generation, promise };
    try { await promise; } finally {
      if (syncingTask?.promise === promise) syncingTask = null;
    }
  }
}));

async function findFace(id: string) {
  const person = useStore.getState().people.find(p => p.id === id);
  if (!person) return;
  try {
    const face = await detectFace(person.photo.bitmap);
    useStore.setState(s => ({ people: patchPerson(s.people, id, { face, faceStatus: face ? 'found' : 'none' }) }));
  } catch {
    useStore.setState(s => ({ people: patchPerson(s.people, id, { faceStatus: 'failed' }) }));
  }
}

function patchPerson(people: Person[], id: string, patch: Partial<Person>): Person[] {
  return people.map(p => (p.id === id ? { ...p, ...patch } : p));
}

function defaultName(fileName: string, index: number): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  // Pasted images and camera files have meaningless names.
  if (!base || /^(image|img|screenshot|photo|dsc|pxl|received)\b/i.test(base) || /^\d+$/.test(base)) {
    return `Customer ${index + 1}`;
  }
  return base.slice(0, 40);
}
