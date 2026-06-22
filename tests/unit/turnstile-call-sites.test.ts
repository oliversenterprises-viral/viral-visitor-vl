import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { claimBanner } from '../../src/public/handlers';
import { setMyReferralCode } from '../../src/public/globals';

/** Real shared turnstile module — window.turnstile mocked, no vi.doMock on turnstile. */
function installTurnstileWidget() {
  (window as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } })
    .turnstile = {
      render: (_el, opts) => {
        const cb = opts.callback as ((t: string) => void) | undefined;
        cb?.('shared-module-turnstile-token');
      },
    };
}

describe('turnstile shared module through handlers.ts + referral.ts', () => {
  beforeEach(() => {
    installTurnstileWidget();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../../src/lib/supabase');
    vi.resetModules();
    delete (window as { turnstile?: unknown }).turnstile;
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('claimBanner (handlers) uses real getTurnstileToken with widget callback', async () => {
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

  it('getMyReferralLinkInstant (referral) invokes record-referral with real Turnstile token', async () => {
    document.body.innerHTML = `
      <div id="referral-turnstile-container" style="display:none"></div>
      <input id="ref-link" />
    `;

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-ATTRIB-REAL',
      search: '',
      href: 'http://localhost/r/VIRAL-ATTRIB-REAL',
    } as Location);

    vi.resetModules();
    installTurnstileWidget();

    const invokeSpy = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    vi.doMock('../../src/lib/supabase', async () => {
      const actual = await vi.importActual<typeof import('../../src/lib/supabase')>('../../src/lib/supabase');
      return {
        ...actual,
        supabase: {
          ...actual.supabase,
          functions: { invoke: invokeSpy },
        },
      };
    });

    const { detectAndStoreAttribution, getMyReferralLinkInstant } = await import('../../src/referral');

    detectAndStoreAttribution();
    await getMyReferralLinkInstant();

    expect(invokeSpy).toHaveBeenCalledWith(
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