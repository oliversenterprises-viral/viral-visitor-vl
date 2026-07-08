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
});