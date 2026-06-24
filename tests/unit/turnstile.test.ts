import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  ensureTurnstileReady,
  getTurnstileSiteKey,
  getTurnstileToken,
} from '../../src/lib/turnstile';

describe('turnstile (shared by referral.ts + handlers.ts)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete (window as { turnstile?: unknown }).turnstile;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('getTurnstileToken passes invisible size for background referral recording', async () => {
    const render = vi.fn((_el, opts: { callback: (t: string) => void; size?: string }) => {
      expect(opts.size).toBe('invisible');
      opts.callback('invisible-token');
    });
    (window as { turnstile?: { render: typeof render } }).turnstile = { render };

    const container = document.createElement('div');
    document.body.appendChild(container);

    const token = await getTurnstileToken(container, 'test-site-key', 'Turnstile for recording', {
      invisible: true,
    });
    expect(token).toBe('invisible-token');
  });

  it('getTurnstileToken rejects when API is missing', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await expect(getTurnstileToken(container, 'test-site-key', 'claim')).rejects.toThrow(
      'Turnstile API not available',
    );
  });
});