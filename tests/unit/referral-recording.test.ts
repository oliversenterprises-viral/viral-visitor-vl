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
  detectAndStoreAttribution,
  getMyReferralLinkInstant,
  hasPendingReferrerAttribution,
  initAttributedReferralRecording,
  isReferralCreditedThisSession,
  resetReferralRecordingStateForTests,
} from '../../src/referral';

function installTurnstileWidget() {
  (window as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } })
    .turnstile = {
      render: (_el, opts) => {
        const cb = opts.callback as ((t: string) => void) | undefined;
        cb?.('test-turnstile-token');
      },
    };
}

function installReferralDom() {
  document.body.innerHTML = `
    <div id="referral-turnstile-container" style="display:none"></div>
    <input id="ref-link" />
    <div id="funnel-credit-gate" class="hidden"></div>
  `;
}

async function flushMicrotasks(maxFrames = 30): Promise<void> {
  for (let i = 0; i < maxFrames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

function recordReferralCalls(): unknown[][] {
  return invokeMock.mock.calls.filter((c) => c[0] === 'record-referral');
}

async function waitForRecordReferralCount(count: number, timeoutMs = 5000): Promise<void> {
  const started = Date.now();
  while (recordReferralCalls().length < count) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        `Expected ${count} record-referral invoke(s), got ${recordReferralCalls().length}`,
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
}

function toastText(): string {
  return document.getElementById('toast-container')?.textContent ?? '';
}

describe('referral recording (funnel-gated Step 1)', () => {
  beforeEach(() => {
    installTurnstileWidget();
    installReferralDom();
    invokeMock.mockReset();
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

  it('initAttributedReferralRecording does NOT invoke record-referral on landing', async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-LANDING',
      search: '',
      href: 'http://localhost/r/VIRAL-LANDING',
    } as Location);

    initAttributedReferralRecording();
    await flushMicrotasks();

    expect(invokeMock).not.toHaveBeenCalled();
    expect(hasPendingReferrerAttribution()).toBe(true);
    expect(isReferralCreditedThisSession()).toBe(false);
  });

  it('getMyReferralLinkInstant invokes record-referral for attributed visitors', async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-FUNNEL',
      search: '',
      href: 'http://localhost/r/VIRAL-FUNNEL',
    } as Location);

    detectAndStoreAttribution();
    expect(hasPendingReferrerAttribution()).toBe(true);
    await getMyReferralLinkInstant();
    await waitForRecordReferralCount(1);

    const call = recordReferralCalls()[0];
    expect((call[1] as { body: Record<string, string> }).body.referrerCode).toBe('VIRAL-FUNNEL');
    expect(isReferralCreditedThisSession()).toBe(true);
  });

  it('retries funnel credit after transient edge failure', async () => {
    let referralCalls = 0;
    invokeMock.mockImplementation(async (name: string) => {
      if (name !== 'record-referral') return { data: { success: true }, error: null };
      referralCalls += 1;
      if (referralCalls === 1) return { data: null, error: new Error('403') };
      return { data: { success: true }, error: null };
    });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-FUNNEL-RETRY',
      search: '',
      href: 'http://localhost/r/VIRAL-FUNNEL-RETRY',
    } as Location);

    detectAndStoreAttribution();
    await getMyReferralLinkInstant();
    await waitForRecordReferralCount(2, 8000);

    expect(recordReferralCalls().length).toBeGreaterThanOrEqual(2);
  }, 10_000);

  it('shows success toast when funnel Step 1 credits referral', async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-TOAST',
      search: '',
      href: 'http://localhost/r/VIRAL-TOAST',
    } as Location);

    detectAndStoreAttribution();
    await getMyReferralLinkInstant();

    await waitForRecordReferralCount(1);
    await vi.waitFor(() => {
      expect(toastText()).toContain('Referral credited');
    });
  });

  it('shows failure toast when funnel credit exhausts retries', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('403') });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-FAIL',
      search: '',
      href: 'http://localhost/r/VIRAL-FAIL',
    } as Location);

    detectAndStoreAttribution();
    await getMyReferralLinkInstant();

    await waitForRecordReferralCount(1);
    await vi.waitFor(
      () => {
        expect(toastText()).toMatch(/Couldn't credit referral/);
      },
      { timeout: 12_000 },
    );
  }, 15_000);
});