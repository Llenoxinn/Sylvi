import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { isPhotoPackage, type PhotoPackage } from './packages';
import { sanitizeSettings, type Settings } from './storage/settings';

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
  const result = await cloud?.auth.signOut();
  if (result?.error) throw result.error;
}

export function onSession(callback: (session: Session | null) => void): () => void {
  if (!cloud) return () => {};
  let revision = 0;
  let active = true;
  const { data } = cloud.auth.onAuthStateChange((_event, session) => {
    revision++;
    if (active) callback(session);
  });
  const initialRevision = revision;
  void cloud.auth.getSession().then(({ data, error }) => {
    if (active && revision === initialRevision) callback(error ? null : data.session);
  }).catch(() => {
    if (active && revision === initialRevision) callback(null);
  });
  return () => { active = false; data.subscription.unsubscribe(); };
}

interface PackageRow {
  id: string;
  name: string;
  items: PhotoPackage['items'];
  updated_at: string;
  deleted_at: string | null;
}

export async function fetchPackages(userId: string): Promise<PhotoPackage[]> {
  if (!cloud) return [];
  const { data, error } = await cloud.from('shop_packages').select('id, name, items, updated_at, deleted_at').eq('user_id', userId).order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as PackageRow[]).map(row => ({
    id: row.id,
    name: row.name,
    items: row.items,
    updatedAt: Date.parse(row.updated_at),
    ...(row.deleted_at ? { deletedAt: Date.parse(row.deleted_at) } : {})
  })).filter(isPhotoPackage);
}

export async function upsertPackage(pkg: PhotoPackage, userId: string): Promise<void> {
  if (!cloud) return;
  if (!isPhotoPackage(pkg)) throw new Error('Invalid package.');
  const { error } = await cloud.from('shop_packages').upsert({
    id: pkg.id,
    user_id: userId,
    name: pkg.name,
    items: pkg.items,
    updated_at: new Date(pkg.updatedAt).toISOString(),
    deleted_at: pkg.deletedAt ? new Date(pkg.deletedAt).toISOString() : null
  });
  if (error) throw new Error(error.message);
}
type SyncedSettings = Omit<Settings, 'theme'>;

export async function fetchSettings(userId: string): Promise<SyncedSettings | null> {
  if (!cloud) return null;
  const { data, error } = await cloud.from('shop_settings').select('settings').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) return null;
  const { theme: _theme, ...settings } = sanitizeSettings(data.settings);
  return settings;
}

export async function pushSettings(settings: Settings, userId: string): Promise<void> {
  if (!cloud) return;
  const { theme: _theme, ...synced } = settings;
  const { error } = await cloud
    .from('shop_settings')
    .upsert({ user_id: userId, settings: synced, updated_at: new Date(settings.updatedAt || Date.now()).toISOString() });
  if (error) throw new Error(error.message);
}
