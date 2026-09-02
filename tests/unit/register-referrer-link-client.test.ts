import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
  isSupabaseConfigured: true,
}));

import { registerReferrerLinkDeadline } from '../../src/lib/share-deadline';

describe('register-referrer-link client', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    localStorage.clear();
    document.body.innerHTML = '<div id="toast-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('retries once then toasts instead of failing silently', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: '503' } });
    const state = await registerReferrerLinkDeadline('VIRAL-REGFAIL1');
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[0][0]).toBe('register-referrer-link');
    expect(state?.status).toBe('pending_share');
    expect(document.getElementById('toast-container')?.textContent).toMatch(/Couldn't register your link/);
  });

  it('toasts when the edge envelope is success:false', async () => {
    invokeMock.mockResolvedValue({
      data: { success: false, error: 'Invalid referrer code' },
      error: null,
    });
    await registerReferrerLinkDeadline('VIRAL-REGFAIL2');
    expect(document.getElementById('toast-container')?.textContent).toMatch(/Couldn't register your link/);
  });

  it('toasts when invoke error carries a success:false JSON body', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: '500',
        context: new Response(JSON.stringify({ success: false, error: 'Could not register your link' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    });
    await registerReferrerLinkDeadline('VIRAL-REGFAIL3');
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(document.getElementById('toast-container')?.textContent).toMatch(/Couldn't register your link/);
  });

  it('does not toast on a successful register', async () => {
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        data: { status: 'pending_share', created_at: '2026-09-02T00:00:00Z' },
      },
      error: null,
    });
    const state = await registerReferrerLinkDeadline('VIRAL-REGOK01');
    expect(state?.status).toBe('pending_share');
    expect(document.getElementById('toast-container')?.textContent || '').not.toMatch(
      /Couldn't register your link/,
    );
  });
});
