import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isPromoKitUnlocked,
  hasPromoKitLinkReady,
  buildPersonalPromoLink,
  buildPromoCaptions,
  bannerUrl,
  PROMO_BANNERS,
} from '../../src/lib/promo-kit';

describe('promo-kit', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    root.removeAttribute('data-vr-share-locked');
    root.removeAttribute('data-vr-has-link');
  });

  afterEach(() => {
    root.removeAttribute('data-vr-share-locked');
    root.removeAttribute('data-vr-has-link');
  });

  it('is locked-only: unlocked only when data-vr-share-locked', () => {
    expect(isPromoKitUnlocked(root)).toBe(false);
    root.setAttribute('data-vr-has-link', '1');
    expect(isPromoKitUnlocked(root)).toBe(false);
    root.setAttribute('data-vr-share-locked', '1');
    expect(isPromoKitUnlocked(root)).toBe(true);
  });

  it('teaser condition: has link ready', () => {
    expect(hasPromoKitLinkReady(root)).toBe(false);
    root.setAttribute('data-vr-has-link', '1');
    expect(hasPromoKitLinkReady(root)).toBe(true);
  });

  it('buildPersonalPromoLink validates VIRAL codes and adds UTMs', () => {
    expect(buildPersonalPromoLink('')).toBeNull();
    expect(buildPersonalPromoLink('not-a-code')).toBeNull();
    const link = buildPersonalPromoLink('VIRAL-97UWEGZ', 'test_cap');
    expect(link).toMatch(/\/r\/VIRAL-97UWEGZ/);
    expect(link).toContain('utm_source=promo_kit');
    expect(link).toContain('utm_content=test_cap');
  });

  it('buildPromoCaptions include personal link', () => {
    const url = 'https://www.viralrefer.app/r/VIRAL-TEST1';
    const caps = buildPromoCaptions(url);
    expect(caps.short).toContain(url);
    expect(caps.long).toContain(url);
    expect(caps.xSafe.toLowerCase()).toContain('viralrefer');
  });

  it('banner catalog is non-empty and URLs are under /assets/banners', () => {
    expect(PROMO_BANNERS.length).toBeGreaterThanOrEqual(4);
    for (const b of PROMO_BANNERS) {
      expect(bannerUrl(b.file)).toMatch(/\/assets\/banners\//);
    }
  });
});
