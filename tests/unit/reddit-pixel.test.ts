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
  });

  it('defaults to the official pixel id and is on without env flags', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', '');
    vi.stubEnv('VITE_REDDIT_PIXEL_ENABLED', '');
    window.history.replaceState(null, '', '/');

    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.OFFICIAL_REDDIT_PIXEL_ID).toBe('a2_ir6sjdbsj2n4');
    expect(mod.getRedditPixelId()).toBe('a2_ir6sjdbsj2n4');
    expect(mod.isRedditPixelEnabled()).toBe(true);

    const calls: unknown[][] = [];
    // @ts-expect-error stub
    window.rdt = (...args: unknown[]) => {
      calls.push(args);
    };
    const existing = document.createElement('script');
    existing.src = 'https://www.redditstatic.com/ads/pixel.js';
    document.head.appendChild(existing);

    mod.initRedditPixel();
    // HTML snippet already bootstrapped — do not double init / PageVisit
    expect(calls.length).toBe(0);
    expect(document.querySelectorAll('script[src*="redditstatic.com"]').length).toBe(1);
  });

  it('treats quoted-empty env as the official pixel id', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', '""');
    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.getRedditPixelId()).toBe('a2_ir6sjdbsj2n4');
    expect(mod.isRedditPixelEnabled()).toBe(true);
  });

  it('stays off when the enable flag is explicitly false', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', 'a2_testpixel123');
    vi.stubEnv('VITE_REDDIT_PIXEL_ENABLED', '0');
    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.isRedditPixelEnabled()).toBe(false);
    mod.initRedditPixel();
    expect(document.querySelector('script[src*="redditstatic.com"]')).toBeNull();
  });

  it('inits pixel script and PageVisit when not already bootstrapped', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', 'a2_testpixel123');
    window.history.replaceState(null, '', '/');

    const mod = await import('../../src/lib/reddit-pixel');
    expect(mod.isRedditPixelEnabled()).toBe(true);

    mod.initRedditPixel();

    expect(document.querySelector('script[src="https://www.redditstatic.com/ads/pixel.js"]')).toBeTruthy();
    expect(typeof window.rdt).toBe('function');
    expect(window.rdt?.callQueue).toEqual(
      expect.arrayContaining([
        ['init', 'a2_testpixel123'],
        ['track', 'PageVisit'],
      ]),
    );

    // second init does not throw / still one script / no extra queue
    const queued = window.rdt?.callQueue?.length ?? 0;
    mod.initRedditPixel();
    expect(document.querySelectorAll('script[src*="redditstatic.com"]').length).toBe(1);
    expect(window.rdt?.callQueue?.length).toBe(queued);
  });

  it('skips on embed path', async () => {
    window.history.replaceState(null, '', '/embed');

    const mod = await import('../../src/lib/reddit-pixel');
    mod.initRedditPixel();
    expect(document.querySelector('script[src*="redditstatic.com"]')).toBeNull();
  });

  it('maps GetReferralLink to Lead track calls when enabled', async () => {
    vi.stubEnv('VITE_REDDIT_PIXEL_ID', 'a2_testpixel123');
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
    vi.stubEnv('VITE_REDDIT_PIXEL_ENABLED', '0');
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
