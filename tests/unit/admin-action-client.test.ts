import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAdminSessionToken, setAdminSessionToken } from '../../src/lib/admin-session';

describe('admin-action-client', () => {
  beforeEach(() => {
    clearAdminSessionToken();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    clearAdminSessionToken();
  });

  it('returns error when admin session is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

    const { invokeAdminAction } = await import('../../src/lib/admin-action-client');
    const result = await invokeAdminAction('get_referrals');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('Admin session required');
  });

  it('getAdminActionHeaders includes x-admin-session when token is set', async () => {
    vi.resetModules();
    setAdminSessionToken('session-token-abc');
    const { getAdminActionHeaders } = await import('../../src/lib/admin-action-client');
    expect(getAdminActionHeaders()).toEqual({ 'x-admin-session': 'session-token-abc' });
  });

  it('aborts a hung admin-action fetch and skips functions.invoke', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    setAdminSessionToken('session-token-abc');

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
          }
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('The operation was aborted.', 'AbortError')),
            { once: true },
          );
        }
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();

    const { invokeAdminAction } = await import('../../src/lib/admin-action-client');
    const started = Date.now();
    const result = await invokeAdminAction('get_owner_funnel_desk', {}, { timeoutMs: 40 });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('timed out');
    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});