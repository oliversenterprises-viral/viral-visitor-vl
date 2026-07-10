import { afterEach, describe, expect, it, vi } from 'vitest';
import { BANNER_EVENTS_KEY } from '../../src/lib/banner-events';
import { setAdminSessionToken, clearAdminSessionToken } from '../../src/lib/admin-session';

describe('getBannerEventsForStats (content re-export / isolated fetch)', () => {
  afterEach(() => {
    localStorage.clear();
    clearAdminSessionToken();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falls back to local events when server returns an empty array', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('test-admin-session-token');
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

    const { getBannerEventsForStats } = await import('../../src/lib/banner-stats-fetch');
    const res = await getBannerEventsForStats();

    expect(res.source).toBe('local');
    expect(res.events).toHaveLength(1);
    expect(res.events[0].label).toBe('Winner Spotlight');
    expect(res.fetchError).toContain('Server has no banner events');
  });

  it('prefers server events when server has rows', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('test-admin-session-token');
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([{ type: 'click', label: 'Local only' }]));
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

    const { getBannerEventsForStats } = await import('../../src/lib/banner-stats-fetch');
    const res = await getBannerEventsForStats();

    expect(res.source).toBe('server');
    expect(res.events).toHaveLength(1);
    expect(res.events[0].label).toBe('Server Banner');
  });
});
