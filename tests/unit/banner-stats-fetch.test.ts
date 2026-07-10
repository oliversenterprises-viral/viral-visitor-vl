import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAdminSessionToken, setAdminSessionToken } from '../../src/lib/admin-session';
import { BANNER_EVENTS_KEY } from '../../src/lib/banner-events';

describe('fetchBannerStatsEvents', () => {
  beforeEach(() => {
    clearAdminSessionToken();
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAdminSessionToken();
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns session error without admin token', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    const { fetchBannerStatsEvents } = await import('../../src/lib/banner-stats-fetch');
    const res = await fetchBannerStatsEvents();
    expect(res.source).toBe('local');
    expect(res.fetchError).toMatch(/session required/i);
  });

  it('maps server rows when admin-action succeeds', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('test-session-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: [
              {
                event_type: 'impression',
                banner_label: 'Server Banner',
                redirect_url: 'https://example.com',
                additional: { key: 'Server Banner|https://example.com' },
                created_at: '2026-06-22T13:00:00Z',
              },
            ],
          }),
      })),
    );
    vi.resetModules();
    const { fetchBannerStatsEvents } = await import('../../src/lib/banner-stats-fetch');
    const res = await fetchBannerStatsEvents();
    expect(res.source).toBe('server');
    expect(res.fetchError).toBeUndefined();
    expect(res.events).toHaveLength(1);
    expect(res.events[0].label).toBe('Server Banner');
    expect(res.events[0].type).toBe('impression');
  });

  it('falls back to local on HTTP business error', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('test-session-token');
    localStorage.setItem(
      BANNER_EVENTS_KEY,
      JSON.stringify([{ type: 'click', label: 'Local only', key: 'Local only' }]),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        text: async () =>
          JSON.stringify({
            success: false,
            error: 'Admin privileges required — re-login with owner password',
          }),
      })),
    );
    vi.resetModules();
    const { fetchBannerStatsEvents } = await import('../../src/lib/banner-stats-fetch');
    const res = await fetchBannerStatsEvents();
    expect(res.source).toBe('local');
    expect(res.fetchError).toMatch(/re-login/i);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].label).toBe('Local only');
  });

  it('shows local when server returns empty array with local present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('test-session-token');
    localStorage.setItem(
      BANNER_EVENTS_KEY,
      JSON.stringify([
        {
          type: 'impression',
          label: 'Winner Spotlight',
          redirectUrl: 'https://www.viralrefer.app/#prize',
          key: 'Winner Spotlight|https://www.viralrefer.app/#prize',
          timestamp: '2026-06-22T12:00:00Z',
        },
      ]),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        text: async () => JSON.stringify({ success: true, data: [] }),
      })),
    );
    vi.resetModules();
    const { fetchBannerStatsEvents } = await import('../../src/lib/banner-stats-fetch');
    const res = await fetchBannerStatsEvents();
    expect(res.source).toBe('local');
    expect(res.events).toHaveLength(1);
    expect(res.fetchError).toContain('Server has no banner events');
  });
});
