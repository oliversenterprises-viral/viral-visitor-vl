import { afterEach, describe, expect, it, vi } from 'vitest';

describe('admin-action-client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns error when admin secret is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('VITE_ADMIN_ACTION_SECRET', '');
    vi.resetModules();

    const { invokeAdminAction } = await import('../../src/lib/admin-action-client');
    const result = await invokeAdminAction('get_referrals');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('Admin secret');
  });
});