import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAdminSessionToken, setAdminSessionToken } from '../../src/lib/admin-session';

describe('admin-action-client', () => {
  beforeEach(() => {
    clearAdminSessionToken();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.useRealTimers();
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

  it('verifyOwnerPassword POSTs Bearer anon + {action, payload} and never uses functions.invoke', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ success: true, session_token: 'hmac-session' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { verifyOwnerPassword, OWNER_PASSWORD_VERIFY_TIMEOUT_MS } = await import(
      '../../src/lib/admin-action-client'
    );
    expect(OWNER_PASSWORD_VERIFY_TIMEOUT_MS).toBe(8_000);
    const result = await verifyOwnerPassword('owner-test-only');
    expect(result.success).toBe(true);
    if (result.success) expect(result.sessionToken).toBe('hmac-session');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/functions/v1/admin-action');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer anon-key');
    expect(headers.apikey).toBe('anon-key');
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      action: 'verify_owner_password',
      payload: { password: 'owner-test-only' },
    });
    expect(body).not.toHaveProperty('session_token');
  });

  it('verifyOwnerPassword times out instead of hanging', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

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

    const { verifyOwnerPassword } = await import('../../src/lib/admin-action-client');
    vi.useFakeTimers();
    const pending = verifyOwnerPassword('owner-test-only');
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    vi.useRealTimers();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.timedOut).toBe(true);
      expect(result.error).toMatch(/timed out/i);
    }
  });

  it('timed invokeAdminAction returns on abort and never falls back to functions.invoke', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    setAdminSessionToken('session-token-abc');

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

    const invoke = vi.fn(() => new Promise(() => {}));
    vi.doMock('../../src/lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: { functions: { invoke } },
    }));

    const { invokeAdminAction } = await import('../../src/lib/admin-action-client');
    vi.useFakeTimers();
    const pending = invokeAdminAction('get_owner_funnel_desk', {}, { timeoutMs: 8_000 });
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    vi.useRealTimers();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/timed out/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('verifyOwnerPassword returns at 8s even when fetch ignores abort', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    const { verifyOwnerPassword } = await import('../../src/lib/admin-action-client');
    vi.useFakeTimers();
    const pending = verifyOwnerPassword('owner-test-only');
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    vi.useRealTimers();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.timedOut).toBe(true);
      expect(result.error).toMatch(/timed out/i);
    }
  });

  it('owner gate uses fetchAdminAction verify, not functions.invoke', () => {
    const modals = readFileSync(resolve(__dirname, '../../src/public/modals.ts'), 'utf8');
    expect(modals).toContain('verifyOwnerPassword');
    expect(modals).not.toMatch(/functions\.invoke/);
    expect(modals).not.toMatch(/from '\.\.\/lib\/supabase'/);
    const client = readFileSync(resolve(__dirname, '../../src/lib/admin-action-client.ts'), 'utf8');
    expect(client).toContain('OWNER_PASSWORD_VERIFY_TIMEOUT_MS');
    expect(client).toContain('Authorization');
    expect(client).toContain('verify_owner_password');
    expect(client).not.toMatch(/VITE_ADMIN|VITE_OWNER/);
  });
});