import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('reddit-pixel', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    // clean DOM / window state between cases
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    // @ts-expect-error test cleanup
    delete window.rdt;
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('is disabled when VITE_REDDIT_PIXEL_ID is empty', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', '');
    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.isRedditPixelEnabled()).toBe(false);
    expect(mod.getRedditPixelId()).toBe('');
    mod.initRedditPixel();
    expect(document.querySelector('script[src*="redditstatic.com"]')).toBeNull();
  });

  it('treats quoted-empty env as disabled', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', '""');
    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.isRedditPixelEnabled()).toBe(false);
  });

  it('stays off when a leftover pixel id is set without the enable flag', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', 'a2_testpixel123');
    vi.stubEnv('VITE_REDDIT_PIXEL_ENABLED', '');
    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.isRedditPixelEnabled()).toBe(false);
    mod.initRedditPixel();
    expect(document.querySelector('script[src*="redditstatic.com"]')).toBeNull();
  });

  it('inits pixel script and PageVisit when enabled and id is set', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', 'a2_testpixel123');
    vi.stubEnv('VITE_REDDIT_PIXEL_ENABLED', '1');
    // not embed
    window.history.replaceState(null, '', '/');

    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.isRedditPixelEnabled()).toBe(true);
    mod.initRedditPixel();

    expect(document.querySelector('script[src="https://www.redditstatic.com/ads/pixel.js"]')).toBeTruthy();
    expect(typeof window.rdt).toBe('function');
    expect(sessionStorage.getItem('vr_rdt_pagevisit')).toBe('1');

    // second init does not throw / still one script
    mod.initRedditPixel();
    expect(document.querySelectorAll('script[src*="redditstatic.com"]').length).toBe(1);
  });

  it('skips on embed path', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', 'a2_testpixel123');
    vi.stubEnv('VITE_REDDIT_PIXEL_ENABLED', '1');
    window.history.replaceState(null, '', '/embed');

    const mod = await import('../../src/lib/reddit-pixel');
    mod.initRedditPixel();
    expect(document.querySelector('script[src*="redditstatic.com"]')).toBeNull();
  });

  it('maps GetReferralLink to Lead track calls when enabled', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', 'a2_testpixel123');
    vi.stubEnv('VITE_REDDIT_PIXEL_ENABLED', '1');
    window.history.replaceState(null, '', '/');

    const calls: unknown[][] = [];
    const stub = (...args: unknown[]) => {
      calls.push(args);
    };
    // @ts-expect-error stub
    window.rdt = stub;

    const mod = await import('../../src/lib/reddit-pixel');
    // ensure enabled path uses existing rdt
    mod.trackRedditFunnelStep('GetReferralLink');

    const tracks = calls.filter((c) => c[0] === 'track');
    expect(tracks.some((c) => c[1] === 'Lead')).toBe(true);
    expect(
      tracks.some(
        (c) =>
          c[1] === 'Custom' &&
          typeof c[2] === 'object' &&
          c[2] !== null &&
          (c[2] as { customEventName?: string }).customEventName === 'GetReferralLink',
      ),
    ).toBe(true);
  });

  it('trackRedditFunnelStep is no-op when disabled', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', '');
    const calls: unknown[][] = [];
    // @ts-expect-error stub
    window.rdt = (...args: unknown[]) => {
      calls.push(args);
    };
    const mod = await import('../../src/lib/reddit-pixel');
    mod.trackRedditFunnelStep('GetReferralLink');
    expect(calls.length).toBe(0);
  });
});
