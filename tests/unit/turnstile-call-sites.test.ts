import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as turnstile from '../../src/lib/turnstile';
import { setMyReferralCode } from '../../src/public/globals';

describe('turnstile through handlers.ts call site', () => {
  beforeEach(() => {
    vi.spyOn(turnstile, 'ensureTurnstileReady').mockResolvedValue(undefined);
    vi.spyOn(turnstile, 'getTurnstileToken').mockResolvedValue('call-site-mock-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('claimBanner calls shared ensureTurnstileReady + getTurnstileToken', async () => {
    const { claimBanner } = await import('../../src/public/handlers');
    setMyReferralCode('VIRAL-CLAIM-SITE');

    document.body.innerHTML = `
      <div id="winner-modal" class="hidden"></div>
      <div id="claim-turnstile-container"></div>
      <span id="claim-referrer-code-display"></span>
    `;

    claimBanner();

    await vi.waitFor(() => expect(turnstile.ensureTurnstileReady).toHaveBeenCalled());
    await vi.waitFor(() => expect(turnstile.getTurnstileToken).toHaveBeenCalled());
    const args = vi.mocked(turnstile.getTurnstileToken).mock.calls.at(-1);
    expect(args?.[2]).toBe('claim');
  });
});

describe('turnstile through referral.ts call site', () => {
  const invokeMock = vi.fn();
  const ensureReadyMock = vi.fn();
  const getTokenMock = vi.fn();

  beforeEach(() => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    ensureReadyMock.mockResolvedValue(undefined);
    getTokenMock.mockResolvedValue('referral-call-site-token');

    vi.doMock('../../src/lib/turnstile', () => ({
      ensureTurnstileReady: ensureReadyMock,
      getTurnstileToken: getTokenMock,
      getTurnstileSiteKey: () => 'dummy-turnstile-sitekey-for-tests',
    }));
    vi.doMock('../../src/lib/supabase', () => ({
      supabase: {
        functions: { invoke: invokeMock },
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      },
      isSupabaseConfigured: true,
    }));

    sessionStorage.clear();
    localStorage.clear();
    document.body.innerHTML = `
      <div id="referral-turnstile-container" style="display:none"></div>
      <input id="ref-link" />
    `;

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-ATTRIB',
      search: '',
      href: 'http://localhost/r/VIRAL-ATTRIB',
    } as Location);

    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../src/lib/turnstile');
    vi.doUnmock('../../src/lib/supabase');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('getMyReferralLinkInstant calls Turnstile + record-referral invoke on attributed visit', async () => {
    const { detectAndStoreAttribution, getMyReferralLinkInstant } = await import('../../src/referral');

    detectAndStoreAttribution();
    await getMyReferralLinkInstant();

    expect(ensureReadyMock).toHaveBeenCalled();
    expect(getTokenMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith(
      'record-referral',
      expect.objectContaining({
        body: expect.objectContaining({
          referrerCode: 'VIRAL-ATTRIB',
          turnstileToken: 'referral-call-site-token',
        }),
      }),
    );
  });
});