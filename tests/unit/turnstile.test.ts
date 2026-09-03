import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  ensureTurnstileReady,
  getCreditTurnstileToken,
  getTurnstileSiteKey,
  getTurnstileToken,
  HUMAN_CHECK_STALL_MESSAGE,
  normalizeTurnstileSize,
  prefetchCreditTurnstileToken,
  resetCreditTurnstileStateForTests,
  tryOptionalTurnstileToken,
  TURNSTILE_READY_TIMEOUT_MS,
  TURNSTILE_SIZES,
} from '../../src/lib/turnstile';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('turnstile (shared by referral.ts + handlers.ts)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete (window as { turnstile?: unknown }).turnstile;
    resetCreditTurnstileStateForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
  });

  it('getTurnstileSiteKey returns a string (empty when env unset)', () => {
    expect(typeof getTurnstileSiteKey()).toBe('string');
  });

  it('ensureTurnstileReady resolves immediately when window.turnstile exists', async () => {
    (window as { turnstile?: object }).turnstile = { render: vi.fn() };
    await expect(ensureTurnstileReady()).resolves.toBeUndefined();
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
  });

  it('getTurnstileToken dev-bypasses when siteKey empty (referral + claim call sites)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);

    const referralToken = await getTurnstileToken(container, '', 'Turnstile');
    const claimToken = await getTurnstileToken(container, '', 'claim');

    expect(referralToken).toBe('dev-bypass-token');
    expect(claimToken).toBe('dev-bypass-token');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('getTurnstileToken renders widget when siteKey and turnstile API present', async () => {
    const render = vi.fn((_el, opts: { callback: (t: string) => void }) => {
      opts.callback('test-token-abc');
    });
    (window as { turnstile?: { render: typeof render } }).turnstile = { render };

    const container = document.createElement('div');
    document.body.appendChild(container);

    const token = await getTurnstileToken(container, 'test-site-key', 'claim');
    expect(token).toBe('test-token-abc');
    expect(render).toHaveBeenCalledOnce();
  });

  it('normalizeTurnstileSize never returns invisible', () => {
    expect(TURNSTILE_SIZES).toEqual(['compact', 'flexible', 'normal']);
    expect(normalizeTurnstileSize('invisible')).toBe('compact');
    expect(normalizeTurnstileSize('INVISIBLE')).toBe('compact');
    expect(normalizeTurnstileSize('flexible')).toBe('flexible');
    expect(normalizeTurnstileSize('normal')).toBe('normal');
    expect(normalizeTurnstileSize(undefined)).toBe('compact');
  });

  it('getTurnstileToken passes compact size for background referral recording', async () => {
    const render = vi.fn((_el, opts: { callback: (t: string) => void; size?: string }) => {
      expect(opts.size).toBe('compact');
      expect(opts.size).not.toBe('invisible');
      opts.callback('compact-token');
    });
    (window as { turnstile?: { render: typeof render } }).turnstile = { render };

    const container = document.createElement('div');
    document.body.appendChild(container);

    const token = await getTurnstileToken(container, 'test-site-key', 'Turnstile for recording', {
      size: 'compact',
      appearance: 'always',
    });
    expect(token).toBe('compact-token');
  });

  it('getCreditTurnstileToken prefers the visible #friend-credit-turnstile host', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITEKEY', 'test-site-key');
    document.body.innerHTML =
      '<div id="friend-credit-turnstile"></div><div id="referral-section"><div id="referral-turnstile-container"></div></div>';
    const friend = document.getElementById('friend-credit-turnstile');
    const render = vi.fn((el: HTMLElement, opts: { callback: (t: string) => void }) => {
      expect(friend?.contains(el)).toBe(true);
      opts.callback('friend-host-token');
    });
    (window as { turnstile?: { render: typeof render } }).turnstile = { render };
    const token = await getCreditTurnstileToken(2000);
    expect(token).toBe('friend-host-token');
  });

  it('getCreditTurnstileToken hosts the widget in #referral-turnstile-container', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITEKEY', 'test-site-key');
    document.body.innerHTML = '<div id="referral-section"><div id="referral-turnstile-container"></div></div>';
    const host = document.getElementById('referral-turnstile-container');
    const render = vi.fn((el: HTMLElement, opts: { callback: (t: string) => void }) => {
      expect(host?.contains(el)).toBe(true);
      opts.callback('hosted-credit-token');
    });
    (window as { turnstile?: { render: typeof render; execute?: () => void } }).turnstile = {
      render,
      execute: () => {},
    };
    const token = await getCreditTurnstileToken(2000);
    expect(token).toBe('hosted-credit-token');
    expect(document.getElementById('referral-turnstile-container')).toBe(host);
  });

  it('getCreditTurnstileToken returns a token when the compact widget succeeds', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITEKEY', 'test-site-key');
    const render = vi.fn(
      (
        _el,
        opts: {
          callback: (t: string) => void;
          size?: string;
          appearance?: string;
          execute?: boolean;
        },
      ) => {
        expect(opts.size).toBe('compact');
        expect(opts.size).not.toBe('invisible');
        expect(opts.appearance).toBe('always');
        expect(opts.execute).toBeFalsy();
        opts.callback('credit-token-ok');
      },
    );
    (window as { turnstile?: { render: typeof render; execute?: () => void } }).turnstile = {
      render,
      execute: () => {},
    };
    const token = await getCreditTurnstileToken(2000);
    expect(token).toBe('credit-token-ok');
  });

  it('credit Turnstile source never asks Cloudflare for size invisible', () => {
    const src = readFileSync(resolve(import.meta.dirname, '../../src/lib/turnstile.ts'), 'utf8');
    expect(src).not.toMatch(/size:\s*['"]invisible['"]/);
    expect(src).not.toMatch(/renderOpts\.size\s*=\s*['"]invisible['"]/);
    expect(src).toContain("size: 'compact'");
    expect(src).toContain("appearance: 'always'");
    expect(src).not.toMatch(/appearance:\s*['"]execute['"]/);
  });

  it('prefetch caches a compact token so Get my link does not render twice', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITEKEY', 'test-site-key');
    const render = vi.fn((_el, opts: { callback: (t: string) => void; size?: string }) => {
      expect(opts.size).toBe('compact');
      opts.callback('prefetched-token');
    });
    (window as { turnstile?: { render: typeof render } }).turnstile = { render };
    prefetchCreditTurnstileToken();
    const first = await getCreditTurnstileToken(2000);
    const second = await getCreditTurnstileToken(2000);
    expect(first).toBe('prefetched-token');
    expect(second).toBe('prefetched-token');
    expect(render).toHaveBeenCalledOnce();
  });

  it('getCreditTurnstileToken returns null when the widget fails (no silent empty POST)', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITEKEY', 'test-site-key');
    const render = vi.fn((_el, opts: { 'error-callback'?: (code?: string) => void }) => {
      opts['error-callback']?.('110200');
    });
    (window as { turnstile?: { render: typeof render } }).turnstile = { render };
    const token = await getCreditTurnstileToken(2000);
    expect(token).toBeNull();
  });

  it('getTurnstileToken rejects when API is missing', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await expect(getTurnstileToken(container, 'test-site-key', 'claim')).rejects.toThrow(
      'Turnstile API not available',
    );
  });

  it('ensureTurnstileReady fail-fast rejects when the human-check never appears', async () => {
    vi.useFakeTimers();
    const pending = ensureTurnstileReady();
    const expectReject = expect(pending).rejects.toThrow(HUMAN_CHECK_STALL_MESSAGE);
    await vi.advanceTimersByTimeAsync(TURNSTILE_READY_TIMEOUT_MS);
    await expectReject;
  });

  it('ensureTurnstileReady does not depend on requestAnimationFrame (hidden-tab safe)', async () => {
    vi.useFakeTimers();
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 0 as unknown as number);
    const pending = ensureTurnstileReady(200);
    const expectReject = expect(pending).rejects.toThrow(HUMAN_CHECK_STALL_MESSAGE);
    await vi.advanceTimersByTimeAsync(200);
    await expectReject;
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });

  it('getTurnstileToken fail-fast rejects when the widget never callbacks', async () => {
    vi.useFakeTimers();
    (window as { turnstile?: { render: () => string } }).turnstile = {
      render: () => 'hung-widget',
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const pending = getTurnstileToken(container, 'test-site-key', 'claim', { timeoutMs: 250 });
    const expectReject = expect(pending).rejects.toThrow(HUMAN_CHECK_STALL_MESSAGE);
    await vi.advanceTimersByTimeAsync(250);
    await expectReject;
  });

  it('tryOptionalTurnstileToken returns null within the deadline when script/API stalls', async () => {
    vi.useFakeTimers();
    const pending = tryOptionalTurnstileToken(300);
    const expectNull = expect(pending).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(300);
    await expectNull;
  });

  it('getCreditTurnstileToken returns null quickly when Turnstile never loads', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_TURNSTILE_SITEKEY', 'test-site-key');
    const pending = getCreditTurnstileToken(400);
    const expectNull = expect(pending).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    await expectNull;
  });
});