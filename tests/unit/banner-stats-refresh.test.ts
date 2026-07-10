import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BANNER_EVENTS_KEY } from '../../src/lib/banner-events';
import { clearAdminSessionToken, setAdminSessionToken } from '../../src/lib/admin-session';

const bannerEvent = {
  type: 'impression',
  label: 'Promo',
  redirectUrl: 'https://example.com',
  key: 'Promo|https://example.com',
  timestamp: '2026-06-22T12:00:00Z',
};

describe('banner stats refresh (edit content)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAdminSessionToken();
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

  it('Refresh completes without throw when server returns data', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('test-session');
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([bannerEvent]));
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
                banner_label: 'Server Promo',
                redirect_url: 'https://example.com',
                created_at: '2026-06-22T13:00:00Z',
              },
            ],
          }),
      })),
    );
    vi.resetModules();

    const { wireBannerStatsQuick } = await import('../../src/admin/banner-stats');
    const root = document.createElement('div');
    root.innerHTML = `<div id="banner-stats-quick"></div>`;
    await wireBannerStatsQuick(root);

    const panel = root.querySelector('#banner-stats-quick') as HTMLElement;
    expect(panel.innerHTML).toContain('Banner Performance');
    expect(panel.innerHTML).toContain('SERVER');

    const refresh = panel.querySelector('[data-banner-stats-refresh]') as HTMLButtonElement;
    expect(refresh).toBeTruthy();
    refresh.click();
    // Allow async refreshBannerStats to settle
    await new Promise((r) => setTimeout(r, 50));

    const after = root.querySelector('#banner-stats-quick') as HTMLElement;
    expect(after.innerHTML).toContain('Banner Performance');
    expect(after.querySelector('[data-banner-stats-refresh]')).toBeTruthy();
    expect((after.querySelector('[data-banner-stats-refresh]') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('Refresh falls back to local without error toast path when admin session missing', async () => {
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify([bannerEvent]));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    // no admin session
    vi.resetModules();

    const { wireBannerStatsQuick } = await import('../../src/admin/banner-stats');
    const root = document.createElement('div');
    root.innerHTML = `<div id="banner-stats-quick"></div>`;
    await wireBannerStatsQuick(root);

    const panel = root.querySelector('#banner-stats-quick') as HTMLElement;
    expect(panel.innerHTML).toContain('Banner Performance');
    expect(panel.innerHTML).toContain('LOCAL');

    const refresh = panel.querySelector('[data-banner-stats-refresh]') as HTMLButtonElement;
    refresh.click();
    await new Promise((r) => setTimeout(r, 50));

    const after = root.querySelector('#banner-stats-quick') as HTMLElement;
    // Still renders — never stuck on "Could not refresh"
    expect(after.innerHTML).toContain('Banner Performance');
    expect(after.innerHTML).toContain('LOCAL');
  });
});
