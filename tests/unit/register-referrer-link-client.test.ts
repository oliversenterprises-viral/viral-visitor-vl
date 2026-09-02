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

import {
  registerReferrerLinkDeadline,
  resetRegisterReferrerLinkCacheForTests,
} from '../../src/lib/share-deadline';
import {
  applyExistingReferralLink,
  getMyReferralLinkInstant,
  resetReferralRecordingStateForTests,
} from '../../src/referral';

describe('one register-referrer-link per Get my link', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    resetRegisterReferrerLinkCacheForTests();
    resetReferralRecordingStateForTests();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = `
      <input id="ref-link" />
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
      <div id="post-link-share" class="hidden" hidden></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resetRegisterReferrerLinkCacheForTests();
    resetReferralRecordingStateForTests();
  });

  it('dedupes concurrent and repeat register calls for the same code', async () => {
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        data: { status: 'pending_share', created_at: '2026-09-02T00:00:00.000Z' },
      },
      error: null,
    });

    const [a, b] = await Promise.all([
      registerReferrerLinkDeadline('viral-once1'),
      registerReferrerLinkDeadline('viral-once1'),
    ]);
    const c = await registerReferrerLinkDeadline('VIRAL-ONCE1');

    expect(a?.code).toBe('VIRAL-ONCE1');
    expect(b?.code).toBe('VIRAL-ONCE1');
    expect(c?.code).toBe('VIRAL-ONCE1');
    const registerCalls = invokeMock.mock.calls.filter((call) => call[0] === 'register-referrer-link');
    expect(registerCalls).toHaveLength(1);
  });

  it('Get my link invokes register-referrer-link once', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, data: { status: 'pending_share' } },
      error: null,
    });

    await getMyReferralLinkInstant();
    await getMyReferralLinkInstant();

    const registerCalls = invokeMock.mock.calls.filter((call) => call[0] === 'register-referrer-link');
    expect(registerCalls).toHaveLength(1);
    expect((registerCalls[0][1] as { body: { referrer_code: string } }).body.referrer_code).toMatch(
      /^VIRAL-/,
    );
  });

  it('does not register again when restoring an already-registered code', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, data: { status: 'pending_share' } },
      error: null,
    });

    await getMyReferralLinkInstant();
    const first = invokeMock.mock.calls.find((call) => call[0] === 'register-referrer-link');
    const code = String((first?.[1] as { body?: { referrer_code?: string } } | undefined)?.body?.referrer_code || '');
    expect(code).toMatch(/^VIRAL-/);
    applyExistingReferralLink(code);
    await Promise.resolve();

    const registerCalls = invokeMock.mock.calls.filter((call) => call[0] === 'register-referrer-link');
    expect(registerCalls).toHaveLength(1);
  });
});
