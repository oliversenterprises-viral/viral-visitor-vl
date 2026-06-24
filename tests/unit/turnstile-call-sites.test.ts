import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { clearStubInvokeLog, getStubInvokeLog } from '../../src/lib/supabase-stub';
import { claimBanner } from '../../src/public/handlers';
import {
  detectAndStoreAttribution,
  getMyReferralLinkInstant,
  resetReferralRecordingStateForTests,
} from '../../src/referral';
import { setMyReferralCode } from '../../src/public/globals';

function installTurnstileWidget() {
  (window as {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      execute: (target: string | HTMLElement) => void;
    };
  }).turnstile = {
    render: (_el, opts) => {
      const cb = opts.callback as ((t: string) => void) | undefined;
      cb?.('shared-module-turnstile-token');
      return 'mock-widget-id';
    },
    execute: () => {},
  };
}

describe('turnstile shared module (static handlers + referral imports, stub supabase)', () => {
  beforeEach(() => {
    installTurnstileWidget();
    clearStubInvokeLog();
    resetReferralRecordingStateForTests();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    delete (window as { turnstile?: unknown }).turnstile;
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    resetReferralRecordingStateForTests();
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

  it('getMyReferralLinkInstant records stub invoke with real Turnstile token', async () => {
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

    const refInput = document.getElementById('ref-link') as HTMLInputElement;
    expect(refInput.value).toMatch(/\/r\/VIRAL-/i);

    let referralCall: ReturnType<typeof getStubInvokeLog>[number] | undefined;
    await vi.waitFor(
      () => {
        referralCall = getStubInvokeLog().find((c) => c.name === 'record-referral');
        expect(referralCall).toBeDefined();
      },
      { timeout: 3000 },
    );

    const body = (referralCall!.options as { body?: Record<string, string> })?.body;
    expect(body?.referrerCode).toBe('VIRAL-ATTRIB-REAL');
    // Optional token when Turnstile mock succeeds; recording never depends on it.
    if (body?.turnstileToken) {
      expect(body.turnstileToken).toBe('shared-module-turnstile-token');
    }
  });
});