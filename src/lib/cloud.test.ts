import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { BUILT_IN_PACKAGES } from './packages';

const client = vi.hoisted(() => ({ auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => client }));
let authEvent: (event: string, session: Session | null) => void;
const unsubscribe = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
  client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  client.auth.onAuthStateChange.mockImplementation(callback => {
    authEvent = callback;
    return { data: { subscription: { unsubscribe } } };
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('cloud trust boundaries', () => {
  it('does not restore an old initial session after logout', async () => {
    let finish!: (result: unknown) => void;
    client.auth.getSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { onSession } = await import('./cloud');
    const callback = vi.fn();
    onSession(callback);
    authEvent('SIGNED_OUT', null);
    finish({ data: { session: { user: { id: 'old-account' } } }, error: null });
    await Promise.resolve();
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('ignores an initial session response after the subscriber was removed', async () => {
    let finish!: (result: unknown) => void;
    client.auth.getSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { onSession } = await import('./cloud');
    const callback = vi.fn();
    const stop = onSession(callback);
    stop();
    finish({ data: { session: null }, error: null });
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('uses the captured user ID for package writes', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    client.from.mockReturnValue({ upsert });
    const { upsertPackage } = await import('./cloud');
    const pkg = { ...BUILT_IN_PACKAGES[0], id: 'custom', deletedAt: 1000, updatedAt: 1000 };
    await upsertPackage(pkg, 'account-a');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'account-a', deleted_at: new Date(1000).toISOString() }));
  });

  it('filters malformed package rows and restricts the query to its owner', async () => {
    const order = vi.fn(async () => ({ data: [{ id: 'broken', name: 'Broken', items: {}, updated_at: new Date().toISOString(), deleted_at: null }], error: null }));
    const eq = vi.fn(() => ({ order }));
    client.from.mockReturnValue({ select: () => ({ eq }) });
    const { fetchPackages } = await import('./cloud');
    expect(await fetchPackages('account-a')).toEqual([]);
    expect(eq).toHaveBeenCalledWith('user_id', 'account-a');
  });
});
