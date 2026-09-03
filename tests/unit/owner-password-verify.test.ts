import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
      OWNER_PASSWORD_VERIFY_TIMEOUT_MS: 8_000,
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

  it('leaves Verifying as soon as verify returns even if HQ desk never opens', async () => {
    vi.resetModules();
    vi.doMock('../../src/lib/admin-action-client', () => ({
      OWNER_PASSWORD_VERIFY_TIMEOUT_MS: 8_000,
      verifyOwnerPassword: vi.fn().mockResolvedValue({
        success: true,
        sessionToken: 'hmac-session',
      }),
    }));
    const { submitAdminPassword } = await import('../../src/public/modals');
    const { ViralRefer } = await import('../../src/lib/global');
    let opened = false;
    ViralRefer.openAdminPanel = () =>
      new Promise(() => {
        opened = true;
      });
    const btn = document.getElementById('admin-owner-gate-submit') as HTMLButtonElement;
    await expect(submitAdminPassword()).resolves.toBeUndefined();
    expect(opened).toBe(true);
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).not.toMatch(/Verifying/);
    expect(btn.innerHTML).toMatch(/Continue/);
  });

  it('leaves Verifying at 8s when verify fetch never settles', async () => {
    vi.resetModules();
    vi.doMock('../../src/lib/admin-action-client', () => ({
      OWNER_PASSWORD_VERIFY_TIMEOUT_MS: 8_000,
      verifyOwnerPassword: vi.fn(() => new Promise(() => {})),
    }));
    const { submitAdminPassword } = await import('../../src/public/modals');
    const btn = document.getElementById('admin-owner-gate-submit') as HTMLButtonElement;
    vi.useFakeTimers();
    const pending = submitAdminPassword();
    await vi.advanceTimersByTimeAsync(8_000);
    await pending;
    vi.useRealTimers();
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).not.toMatch(/Verifying/);
    expect(btn.innerHTML).toMatch(/Continue/);
  });

  it('does not await openAdminPanel before restoring Continue', () => {
    const src = readFileSync(resolve(__dirname, '../../src/public/modals.ts'), 'utf8');
    expect(src).not.toMatch(/await ViralRefer\.openAdminPanel/);
    expect(src).toContain('void Promise.resolve(ViralRefer.openAdminPanel?.())');
    expect(src).toContain('verifyOwnerPassword');
    expect(src).toContain('OWNER_PASSWORD_VERIFY_TIMEOUT_MS');
    expect(src).toContain('Promise.race');
    expect(src).not.toMatch(/functions\.invoke/);
  });
});
