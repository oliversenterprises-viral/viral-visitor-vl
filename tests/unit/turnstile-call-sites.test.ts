import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { clearStubInvokeLog, getStubInvokeLog } from '../../src/lib/supabase-stub';
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

describe('turnstile shared module (static handlers + referral imports, stub supabase)', () => {
  beforeEach(() => {
    installTurnstileWidget();
    clearStubInvokeLog();
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

    const calls = getStubInvokeLog();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].name).toBe('record-referral');
    const body = (calls[0].options as { body?: Record<string, string> })?.body;
    expect(body?.referrerCode).toBe('VIRAL-ATTRIB-REAL');
    expect(body?.turnstileToken).toBe('shared-module-turnstile-token');
  });
});