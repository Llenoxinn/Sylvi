import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { PhotoPackage } from './packages';
import type { Settings } from './storage/settings';

/**
 * Optional shop accounts. Only packages and settings are synced — never
 * customer photos. Without Supabase keys the app runs as a guest app and the
 * sign-in button is hidden.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloud: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const accountsEnabled = cloud !== null;

/** Leaves the page for Google's sign-in and comes back to /app/ signed in. */
export async function signInWithGoogle(): Promise<void> {
  if (!cloud) throw new Error('Accounts aren’t set up on this copy of Sylvi.');
  const { error } = await cloud.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/app/` } });
  if (error) throw new Error(error.message);
}

export async function sendSignInLink(email: string): Promise<void> {
  if (!cloud) throw new Error('Accounts aren’t set up on this copy of Sylvi.');
  const { error } = await cloud.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/app/` } });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await cloud?.auth.signOut();
}

export function onSession(callback: (session: Session | null) => void): () => void {
  if (!cloud) return () => {};
  cloud.auth.getSession().then(({ data }) => callback(data.session));
  const { data } = cloud.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

interface PackageRow {
  id: string;
  name: string;
  items: PhotoPackage['items'];
  updated_at: string;
}

export async function fetchPackages(): Promise<PhotoPackage[]> {
  if (!cloud) return [];
  const { data, error } = await cloud.from('shop_packages').select('id, name, items, updated_at').order('created_at');
  if (error) throw new Error(error.message);
  return (data as PackageRow[]).map(row => ({
    id: row.id,
    name: row.name,
    items: row.items,
    updatedAt: Date.parse(row.updated_at)
  }));
}

export async function upsertPackage(pkg: PhotoPackage): Promise<void> {
  if (!cloud) return;
  const { error } = await cloud.from('shop_packages').upsert({
    id: pkg.id,
    name: pkg.name,
    items: pkg.items,
    updated_at: new Date(pkg.updatedAt).toISOString()
  });
  if (error) throw new Error(error.message);
}

export async function deletePackage(id: string): Promise<void> {
  if (!cloud) return;
  const { error } = await cloud.from('shop_packages').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

type SyncedSettings = Omit<Settings, 'theme'>;

export async function fetchSettings(): Promise<SyncedSettings | null> {
  if (!cloud) return null;
  const { data, error } = await cloud.from('shop_settings').select('settings').maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.settings as SyncedSettings | undefined) ?? null;
}

export async function pushSettings(settings: Settings): Promise<void> {
  if (!cloud) return;
  const { theme: _theme, ...synced } = settings;
  const { data: auth } = await cloud.auth.getUser();
  if (!auth.user) return;
  const { error } = await cloud
    .from('shop_settings')
    .upsert({ user_id: auth.user.id, settings: synced, updated_at: new Date(settings.updatedAt || Date.now()).toISOString() });
  if (error) throw new Error(error.message);
}

/** Newest copy of each package wins; packages that exist on one side only are kept. */
export function mergePackages(local: PhotoPackage[], remote: PhotoPackage[]): { merged: PhotoPackage[]; toUpload: PhotoPackage[] } {
  const byId = new Map(remote.map(p => [p.id, p]));
  const toUpload: PhotoPackage[] = [];
  for (const pkg of local) {
    const other = byId.get(pkg.id);
    if (!other || pkg.updatedAt > other.updatedAt) {
      byId.set(pkg.id, pkg);
      toUpload.push(pkg);
    }
  }
  return { merged: [...byId.values()], toUpload };
}
