import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAdminSessionToken, setAdminSessionToken } from '../../src/lib/admin-session';

describe('fetchVisitorFunnelEvents', () => {
  beforeEach(() => {
    clearAdminSessionToken();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAdminSessionToken();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns session error without admin token', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    const { fetchVisitorFunnelEvents } = await import('../../src/lib/visitor-funnel-fetch');
    const res = await fetchVisitorFunnelEvents();
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
                event_name: 'SiteLanding',
                visitor_id: 'v1',
                session_id: 's1',
                utm_source: 'x',
                metadata: { client_ip: '1.2.3.4' },
                created_at: '2026-07-01T00:00:00Z',
              },
            ],
          }),
      })),
    );
    vi.resetModules();
    const { fetchVisitorFunnelEvents } = await import('../../src/lib/visitor-funnel-fetch');
    const res = await fetchVisitorFunnelEvents();
    expect(res.source).toBe('server');
    expect(res.fetchError).toBeUndefined();
    expect(res.events).toHaveLength(1);
    expect(res.events[0].event_name).toBe('SiteLanding');
    expect((res.events[0].metadata as { client_ip?: string }).client_ip).toBe('1.2.3.4');
  });

  it('falls back to local on HTTP business error', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('test-session-token');
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
    const { fetchVisitorFunnelEvents } = await import('../../src/lib/visitor-funnel-fetch');
    const res = await fetchVisitorFunnelEvents();
    expect(res.source).toBe('local');
    expect(res.fetchError).toMatch(/re-login/i);
  });
});
