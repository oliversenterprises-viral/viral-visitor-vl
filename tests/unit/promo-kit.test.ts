import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isPromoKitUnlocked,
  hasPromoKitLinkReady,
  buildPersonalPromoLink,
  buildPromoCaptions,
  buildXSafePromoCaption,
  isXAlgorithmSafeCaption,
  resolvePromoCaptionKind,
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

  it('non-X captions include personal link; X-safe has no domain/url', () => {
    const url = 'https://www.viralrefer.app/r/VIRAL-TEST1';
    const caps = buildPromoCaptions(url, 'VIRAL-TEST1');
    expect(caps.short).toContain(url);
    expect(caps.long).toContain(url);
    expect(isXAlgorithmSafeCaption(caps.xSafe)).toBe(true);
    expect(caps.xSafe).not.toMatch(/https?:\/\//i);
    expect(caps.xSafe).not.toMatch(/viralrefer\.app/i);
    expect(caps.xSafe.toLowerCase()).toContain('google');
    expect(caps.xSafe).toContain('VIRAL-TEST1');
  });

  it('buildXSafePromoCaption never includes flagged domain patterns', () => {
    const cap = buildXSafePromoCaption('VIRAL-ABC123');
    expect(isXAlgorithmSafeCaption(cap)).toBe(true);
    expect(cap).not.toMatch(/x\.com/i);
  });

  it('isXAlgorithmSafeCaption rejects domains and urls', () => {
    expect(isXAlgorithmSafeCaption('hello world')).toBe(true);
    expect(isXAlgorithmSafeCaption('see https://www.viralrefer.app')).toBe(false);
    expect(isXAlgorithmSafeCaption('viralrefer.app rocks')).toBe(false);
    expect(isXAlgorithmSafeCaption('https://x.com/foo')).toBe(false);
  });

  it('resolvePromoCaptionKind maps x/twitter to xSafe', () => {
    expect(resolvePromoCaptionKind('short')).toBe('short');
    expect(resolvePromoCaptionKind('long')).toBe('long');
    expect(resolvePromoCaptionKind('xSafe')).toBe('xSafe');
    expect(resolvePromoCaptionKind('x')).toBe('xSafe');
    expect(resolvePromoCaptionKind('twitter')).toBe('xSafe');
  });

  it('banner catalog is non-empty and URLs are under /assets/banners', () => {
    expect(PROMO_BANNERS.length).toBeGreaterThanOrEqual(4);
    for (const b of PROMO_BANNERS) {
      expect(bannerUrl(b.file)).toMatch(/\/assets\/banners\//);
    }
  });
});
