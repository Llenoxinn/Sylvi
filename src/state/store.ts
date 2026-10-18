import { create } from 'zustand';
import * as cloud from '../lib/cloud';
import { NO_ADJUST, type Adjust } from '../lib/image/adjust';
import type { Crop } from '../lib/image/crop';
import { detectFace } from '../lib/image/face';
import { loadPhoto, PhotoError } from '../lib/image/load';
import { BUILT_IN_PACKAGES, type PhotoPackage } from '../lib/packages';
import type { Person } from '../lib/person';
import { likeRecent, listRecent, removeRecent, rewindowRecent, saveRecent, type RecentJob } from '../lib/storage/recent';
import {
  loadCustomPackages,
  loadSettings,
  saveCustomPackages,
  saveSettings,
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
  account: { email: string } | null;
  syncing: boolean;
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
  savePackage(pkg: PhotoPackage): void;
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
  setAccount(email: string | null): Promise<void>;
}

export type Store = State & Actions;

let toastSeq = 0;
const newId = () => crypto.randomUUID();

export function allPackages(custom: PhotoPackage[]): PhotoPackage[] {
  return [...BUILT_IN_PACKAGES, ...custom];
}

export function findPackage(custom: PhotoPackage[], id: string): PhotoPackage {
  return allPackages(custom).find(p => p.id === id) ?? BUILT_IN_PACKAGES[1];
}

let settingsPush: ReturnType<typeof setTimeout> | undefined;

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
  busy: null,
  doneJobId: null,

  async addPhotos(files) {
    if (files.length) set({ doneJobId: null }); // new work: the last job is behind us
    for (const file of files) {
      try {
        const photo = await loadPhoto(file, file.name);
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
    set(s => ({ people: patchPerson(s.people, id, { packageId }) }));
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
    get().people.forEach(p => p.photo.bitmap.close());
    set({ people: [], activeId: null, cropEditorFor: null, doneJobId: null });
  },

  updateSettings(patch) {
    const before = get().settings;
    const settings = { ...before, ...patch, updatedAt: Date.now() };
    set({ settings });
    saveSettings(settings);
    if (patch.recentHours && patch.recentHours !== before.recentHours) {
      void rewindowRecent(patch.recentHours).then(recent => set({ recent }));
    }
    if (get().account) {
      clearTimeout(settingsPush);
      settingsPush = setTimeout(() => void cloud.pushSettings(get().settings).catch(() => {}), 1200);
    }
  },

  savePackage(pkg) {
    const saved = { ...pkg, builtIn: false, updatedAt: Date.now() };
    const exists = get().customPackages.some(p => p.id === saved.id);
    const customPackages = exists
      ? get().customPackages.map(p => (p.id === saved.id ? saved : p))
      : [...get().customPackages, saved];
    set({ customPackages });
    saveCustomPackages(customPackages);
    if (get().account) {
      cloud.upsertPackage(saved).catch(() => get().toast('Saved on this computer. It will sync when you’re back online.', 'info'));
    }
  },

  deletePackage(id) {
    const customPackages = get().customPackages.filter(p => p.id !== id);
    const fallback = get().settings.defaultPackageId === id ? BUILT_IN_PACKAGES[1].id : get().settings.defaultPackageId;
    set(s => ({
      customPackages,
      people: s.people.map(p => (p.packageId === id ? { ...p, packageId: fallback } : p))
    }));
    saveCustomPackages(customPackages);
    if (fallback !== get().settings.defaultPackageId) get().updateSettings({ defaultPackageId: fallback });
    if (get().account) cloud.deletePackage(id).catch(() => {});
  },

  async refreshRecent() {
    set({ recent: await listRecent() });
  },

  async rememberJob(job) {
    set({ recent: await saveRecent(job), doneJobId: job.id });
  },

  async reopenJob(job) {
    get().clearAll();
    const people: Person[] = [];
    for (const saved of job.people) {
      try {
        const photo = await loadPhoto(saved.photo);
        people.push({
          id: newId(),
          name: saved.name,
          photo,
          face: saved.face,
          faceStatus: saved.face ? 'found' : 'none',
          crops: saved.crops,
          adjust: saved.adjust,
          packageId: findPackage(get().customPackages, saved.packageId).id
        });
      } catch {
        /* skip a photo that can no longer be read */
      }
    }
    set({ people, activeId: people[0]?.id ?? null, panel: null });
    get().updateSettings({ ...job.settings, paper: { ...job.settings.paper } });
    get().toast(`Reopened ${job.title}.`, 'success');
  },

  async forgetJob(id) {
    set(s => ({ doneJobId: s.doneJobId === id ? null : s.doneJobId }));
    set({ recent: await removeRecent(id) });
  },

  async likeJob(id) {
    // Update the screen right away; storage may be unavailable (private mode).
    set(s => ({ recent: s.recent.map(j => (j.id === id ? { ...j, liked: true } : j)) }));
    await likeRecent(id);
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

  async setAccount(email) {
    if (!email) {
      set({ account: null });
      return;
    }
    if (get().account?.email === email) return;
    set({ account: { email }, syncing: true });
    try {
      const [remotePackages, remoteSettings] = await Promise.all([cloud.fetchPackages(), cloud.fetchSettings()]);
      const { merged, toUpload } = cloud.mergePackages(get().customPackages, remotePackages);
      set({ customPackages: merged });
      saveCustomPackages(merged);
      await Promise.all(toUpload.map(cloud.upsertPackage));
      const local = get().settings;
      if (remoteSettings && remoteSettings.updatedAt > local.updatedAt) {
        const settings = { ...local, ...remoteSettings, theme: local.theme };
        set({ settings });
        saveSettings(settings);
      } else {
        await cloud.pushSettings(local);
      }
    } catch {
      get().toast('Signed in, but your packages couldn’t sync right now. They’re still saved on this computer.', 'error');
    } finally {
      set({ syncing: false });
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
