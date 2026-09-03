import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('owner password gate button', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="admin-owner-gate-modal">
        <div id="admin-owner-gate-error" class="hidden">Incorrect — try again.</div>
        <input id="admin-owner-gate-input" value="x" />
        <button type="button" id="admin-owner-gate-submit"><span>Continue</span></button>
      </div>
    `;
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('restores Continue after a timed-out verify and never stays on Verifying', async () => {
    vi.resetModules();
    vi.doMock('../../src/lib/admin-action-client', () => ({
      verifyOwnerPassword: vi.fn().mockResolvedValue({
        success: false,
        error: 'Owner verify timed out — try again.',
        timedOut: true,
      }),
    }));
    const { submitAdminPassword } = await import('../../src/public/modals');
    const btn = document.getElementById('admin-owner-gate-submit') as HTMLButtonElement;
    await submitAdminPassword();
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).not.toMatch(/Verifying/);
    expect(btn.innerHTML).toMatch(/Continue/);
    const err = document.getElementById('admin-owner-gate-error');
    expect(err?.classList.contains('hidden')).toBe(false);
    expect(err?.textContent).toMatch(/timed out/i);
  });
});
