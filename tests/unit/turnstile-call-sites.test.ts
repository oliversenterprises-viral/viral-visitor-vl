import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const invokeMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
);

vi.mock('../../src/lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/supabase')>();
  return {
    ...actual,
    supabase: {
      ...actual.supabase,
      functions: { invoke: invokeMock },
    },
  };
});

import { claimBanner } from '../../src/public/handlers';
import { detectAndStoreAttribution, getMyReferralLinkInstant } from '../../src/referral';
import { setMyReferralCode } from '../../src/public/globals';

function installTurnstileWidget() {
  (window as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } })
    .turnstile = {
      render: (_el, opts) => {
        const cb = opts.callback as ((t: string) => void) | undefined;
        cb?.('shared-module-turnstile-token');
      },
    };
}

describe('turnstile shared module (static handlers + referral imports)', () => {
  beforeEach(() => {
    installTurnstileWidget();
    invokeMock.mockClear();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    delete (window as { turnstile?: unknown }).turnstile;
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('claimBanner uses real getTurnstileToken via window.turnstile', async () => {
    setMyReferralCode('VIRAL-CLAIM-REAL');
    document.body.innerHTML = `
      <div id="winner-modal" class="hidden"></div>
      <div id="claim-turnstile-container"></div>
      <span id="claim-referrer-code-display"></span>
    `;

    claimBanner();

    await vi.waitFor(() => {
      expect(document.getElementById('claim-turnstile-container')?.childElementCount).toBeGreaterThan(0);
    });
  });

  it('getMyReferralLinkInstant uses real Turnstile and invokes record-referral', async () => {
    document.body.innerHTML = `
      <div id="referral-turnstile-container" style="display:none"></div>
      <input id="ref-link" />
    `;

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-ATTRIB-REAL',
      search: '',
      href: 'http://localhost/r/VIRAL-ATTRIB-REAL',
    } as Location);

    detectAndStoreAttribution();
    await getMyReferralLinkInstant();

    expect(invokeMock).toHaveBeenCalledWith(
      'record-referral',
      expect.objectContaining({
        body: expect.objectContaining({
          referrerCode: 'VIRAL-ATTRIB-REAL',
          turnstileToken: 'shared-module-turnstile-token',
        }),
      }),
    );
  });
});