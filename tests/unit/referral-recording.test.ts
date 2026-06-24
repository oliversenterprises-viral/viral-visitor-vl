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
  initAttributedReferralRecording,
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
  `;
}

async function flushLandingRecording(maxFrames = 30): Promise<void> {
  for (let i = 0; i < maxFrames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function waitForInvokeCount(count: number, timeoutMs = 5000): Promise<void> {
  const started = Date.now();
  while (invokeMock.mock.calls.length < count) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Expected ${count} invoke(s), got ${invokeMock.mock.calls.length}`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
}

function toastText(): string {
  return document.getElementById('toast-container')?.textContent ?? '';
}

describe('referral recording (landing + retry)', () => {
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

  it('initAttributedReferralRecording invokes record-referral on landing', async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-LANDING',
      search: '',
      href: 'http://localhost/r/VIRAL-LANDING',
    } as Location);

    initAttributedReferralRecording();
    await flushLandingRecording();

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    const call = invokeMock.mock.calls.find((c) => c[0] === 'record-referral');
    expect(call).toBeDefined();
    expect((call![1] as { body: Record<string, string> }).body.referrerCode).toBe('VIRAL-LANDING');
  });

  it('retries on landing after transient Turnstile/edge failure', async () => {
    let calls = 0;
    invokeMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return { data: null, error: new Error('403') };
      return { data: { success: true }, error: null };
    });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-LANDING-RETRY',
      search: '',
      href: 'http://localhost/r/VIRAL-LANDING-RETRY',
    } as Location);

    initAttributedReferralRecording();
    await waitForInvokeCount(2, 8000);
    expect(invokeMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('retries after failure when user clicks Get my referral link', async () => {
    let calls = 0;
    invokeMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return { data: null, error: new Error('edge down') };
      return { data: { success: true }, error: null };
    });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-RETRY',
      search: '',
      href: 'http://localhost/r/VIRAL-RETRY',
    } as Location);

    detectAndStoreAttribution();
    initAttributedReferralRecording();
    await flushLandingRecording();

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    await getMyReferralLinkInstant();

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows success toast when referral is credited', async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-TOAST',
      search: '',
      href: 'http://localhost/r/VIRAL-TOAST',
    } as Location);

    initAttributedReferralRecording();
    await flushLandingRecording();

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(toastText()).toContain('Referral credited');
    });
  });

  it('shows failure toast when recording fails', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('403') });

    vi.stubGlobal('location', {
      pathname: '/r/VIRAL-FAIL',
      search: '',
      href: 'http://localhost/r/VIRAL-FAIL',
    } as Location);

    initAttributedReferralRecording();
    await flushLandingRecording();

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(toastText()).toContain("Couldn't credit referral");
    });
  });
});