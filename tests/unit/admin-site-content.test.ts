import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mapSiteContentRows,
  normalizeSiteContentList,
} from '../../src/lib/admin-site-content';
import { clearAdminSessionToken, setAdminSessionToken } from '../../src/lib/admin-session';

describe('admin site_content helpers', () => {
  it('maps get_site_content rows the way live HQ does (key or id)', () => {
    expect(
      mapSiteContentRows([
        { key: 'affiliates_program', value: { affiliates: [] } },
        { id: 'live_prize_winner', value: { label: 'Example', url: 'https://ex.test' } },
        { key: '  ', value: 'skip' },
        null,
      ]),
    ).toEqual({
      affiliates_program: { affiliates: [] },
      live_prize_winner: { label: 'Example', url: 'https://ex.test' },
    });
  });

  it('returns {} when the edge envelope is not an array (live Eu fallback)', () => {
    expect(mapSiteContentRows(null)).toEqual({});
    expect(mapSiteContentRows({ key: 'x' })).toEqual({});
  });

  it('normalizes Website-tab rows and sorts by id', () => {
    expect(
      normalizeSiteContentList([
        { key: 'zeta', value: 1 },
        { id: 'alpha', value: 2 },
        { key: '' },
      ]),
    ).toEqual([
      { id: 'alpha', value: 2 },
      { id: 'zeta', value: 1 },
    ]);
  });
});

describe('fetchAdminSiteContent', () => {
  beforeEach(() => {
    clearAdminSessionToken();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.unstubAllGlobals();
    clearAdminSessionToken();
  });

  it('calls get_site_content with optional key and maps data[]', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('session-token-abc');
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: [{ key: 'affiliates_program', value: { affiliates: [{ code: 'A1' }] } }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchAdminSiteContent } = await import('../../src/lib/admin-site-content');
    const map = await fetchAdminSiteContent('affiliates_program');
    expect(map.affiliates_program).toEqual({ affiliates: [{ code: 'A1' }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.action).toBe('get_site_content');
    expect(body.payload).toEqual({ key: 'affiliates_program' });
    expect(body.session_token).toBe('session-token-abc');
  });

  it('throws live Website copy when get_site_content fails', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('session-token-abc');
    vi.resetModules();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        text: async () => JSON.stringify({ success: false, error: 'Unknown action' }),
      }),
    );

    const { fetchAdminSiteContent, fetchAdminSiteContentRows } = await import(
      '../../src/lib/admin-site-content'
    );
    await expect(fetchAdminSiteContent()).resolves.toEqual({});
    await expect(fetchAdminSiteContentRows()).rejects.toThrow('Unknown action');
  });
});
