import { afterEach, describe, expect, it, vi } from 'vitest';

describe('supabase configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('exports isSupabaseConfigured boolean from live module', async () => {
    const mod = await import('../../src/lib/supabase');
    expect(typeof mod.isSupabaseConfigured).toBe('boolean');
  });

  it('fetch helpers return safe empty defaults when env is empty', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();

    const mod = await import('../../src/lib/supabase');
    expect(mod.isSupabaseConfigured).toBe(false);
    await expect(mod.fetchLeaderboard()).resolves.toEqual([]);
    await expect(mod.fetchTotalReferrers()).resolves.toBe(0);
    await expect(mod.fetchSiteContent()).resolves.toEqual({});
  });

  it('stub client invoke returns error without network', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();

    const mod = await import('../../src/lib/supabase');
    const { data, error } = await mod.supabase.functions.invoke('record-referral', { body: {} });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});