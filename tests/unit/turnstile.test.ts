import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  ensureTurnstileReady,
  getCreditTurnstileToken,
  getTurnstileSiteKey,
  getTurnstileToken,
  normalizeTurnstileSize,
  TURNSTILE_SIZES,
} from '../../src/lib/turnstile';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('turnstile (shared by referral.ts + handlers.ts)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete (window as { turnstile?: unknown }).turnstile;
  });

  afterEach(() => {
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
      appearance: 'execute',
      execute: true,
    });
    expect(token).toBe('compact-token');
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

  it('getCreditTurnstileToken returns a token when the compact execute widget succeeds', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITEKEY', 'test-site-key');
    const render = vi.fn((_el, opts: { callback: (t: string) => void; size?: string }) => {
      expect(opts.size).toBe('compact');
      expect(opts.size).not.toBe('invisible');
      opts.callback('credit-token-ok');
    });
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
});