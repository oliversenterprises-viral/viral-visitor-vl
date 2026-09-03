import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAdminSessionToken, clearAdminSessionToken } from '../../src/lib/admin-session';

describe('owner funnel desk fetch abort', () => {
  beforeEach(() => {
    clearAdminSessionToken();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://wqbefjzpgsezzwdrvvua.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.useRealTimers();
    clearAdminSessionToken();
  });

  it('renderOwnerFunnelDesk aborts at 8s and paints an honest timeout', async () => {
    setAdminSessionToken('hmac-session');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );

    const { renderOwnerFunnelDesk, OWNER_FUNNEL_DESK_TIMEOUT_NOTE } = await import(
      '../../src/admin/owner-funnel-desk'
    );
    const container = document.createElement('div');
    vi.useFakeTimers();
    const pending = renderOwnerFunnelDesk(container);
    await vi.advanceTimersByTimeAsync(8_000);
    await pending;
    vi.useRealTimers();
    expect(container.textContent).toContain(OWNER_FUNNEL_DESK_TIMEOUT_NOTE);
    expect(container.textContent).not.toMatch(/Verifying/);
    expect(container.querySelectorAll('[data-owner-desk-tiles] article').length).toBe(6);
    expect(container.querySelector('[data-owner-desk-gsc]')).toBeTruthy();
  });

  it('never uses functions.invoke for the Command desk first paint', async () => {
    setAdminSessionToken('hmac-session');
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            visits: 4,
            friendLandings: 2,
            getLink: 1,
            share: 0,
            locked: 0,
            getLinkRate: '50.0%',
            windowDays: 7,
            feed: [],
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const invoke = vi.fn(() => new Promise(() => {}));
    vi.doMock('../../src/lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: { functions: { invoke } },
    }));

    const { renderOwnerFunnelDesk } = await import('../../src/admin/owner-funnel-desk');
    const container = document.createElement('div');
    await renderOwnerFunnelDesk(container);
    expect(invoke).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://wqbefjzpgsezzwdrvvua.supabase.co/functions/v1/admin-action');
    const body = JSON.parse(String(init.body));
    expect(body.action).toBe('get_owner_funnel_desk');
    expect(body.session_token).toBe('hmac-session');
    expect((init.headers as Record<string, string>)['x-admin-session']).toBe('hmac-session');
    expect(container.textContent).toMatch(/Visits/);
  });
});
