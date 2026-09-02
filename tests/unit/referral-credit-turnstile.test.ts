import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const creditTokenMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
  isSupabaseConfigured: true,
}));

vi.mock('../../src/lib/turnstile', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/turnstile')>(
    '../../src/lib/turnstile',
  );
  return {
    ...actual,
    getCreditTurnstileToken: (...args: unknown[]) => creditTokenMock(...args),
  };
});

import {
  detectAndStoreAttribution,
  getMyReferralLinkInstant,
  resetReferralRecordingStateForTests,
} from '../../src/referral';

describe('record-referral requires a Turnstile token', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    creditTokenMock.mockReset();
    resetReferralRecordingStateForTests();
    sessionStorage.clear();
    localStorage.clear();
    document.body.innerHTML = `
      <div id="toast-container"></div>
      <input id="ref-link" />
      <div id="post-link-share" hidden>
        <h2 id="post-link-heading"></h2>
        <button type="button" id="post-link-primary"></button>
      </div>
    `;
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resetReferralRecordingStateForTests();
    vi.unstubAllGlobals();
  });

  it('does not POST record-referral when there is no token', async () => {
    creditTokenMock.mockResolvedValue(null);
    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-NOTOKEN',
      search: '',
      href: 'http://localhost/r/VIRAL-NOTOKEN',
    } as Location);

    detectAndStoreAttribution();
    await getMyReferralLinkInstant();
    await vi.waitFor(() => {
      expect(document.getElementById('toast-container')?.textContent).toMatch(
        /Couldn't credit referral/,
      );
    });
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'record-referral')).toHaveLength(0);
  });
});
