import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPaidOrRedditTraffic,
  resolvePaidTrafficSignals,
  initPaidConversionBoost,
  forceMobileGetLinkBar,
  PAID_MOBILE_DWELL_MS,
} from '../../src/lib/paid-conversion-boost';
import { captureUtmAttribution } from '../../src/lib/utm-attribution';

describe('paid-conversion-boost', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-vr-paid-landing');
    document.documentElement.removeAttribute('data-vr-referred-landing');
    delete document.documentElement.dataset.vrPaidBoostBound;
    document.body.innerHTML = `
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
      <div id="mobile-referral-cta" class="hidden"><button><span>Step 1</span></button></div>
      <input id="ref-link" value="" />
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById('vr-paid-getlink-nudge')?.remove();
  });

  it('isPaidOrRedditTraffic detects utm reddit and paid medium', () => {
    expect(
      isPaidOrRedditTraffic({
        utmSource: 'reddit',
        utmMedium: 'paid',
        referrer: '',
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe(true);
    expect(
      isPaidOrRedditTraffic({
        utmSource: 'google',
        utmMedium: 'cpc',
        referrer: '',
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe(true);
    expect(
      isPaidOrRedditTraffic({
        utmSource: null,
        utmMedium: null,
        referrer: 'https://www.reddit.com/r/something',
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe(true);
    expect(
      isPaidOrRedditTraffic({
        utmSource: null,
        utmMedium: null,
        referrer: '',
        userAgent: 'Mozilla/5.0 Reddit/2024.1',
      }),
    ).toBe(true);
    expect(
      isPaidOrRedditTraffic({
        utmSource: 'newsletter',
        utmMedium: 'email',
        referrer: 'https://example.com',
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe(false);
  });

  it('resolvePaidTrafficSignals reads stored UTM', () => {
    vi.stubGlobal('location', {
      search: '?utm_source=reddit&utm_medium=paid&utm_campaign=wave2',
      pathname: '/',
    });
    captureUtmAttribution();
    const s = resolvePaidTrafficSignals(location as Location, window);
    expect(s.utmSource).toBe('reddit');
    expect(s.utmMedium).toBe('paid');
  });

  it('forceMobileGetLinkBar reveals sticky CTA', () => {
    forceMobileGetLinkBar();
    const bar = document.getElementById('mobile-referral-cta');
    expect(bar?.classList.contains('hidden')).toBe(false);
    expect(bar?.textContent).toMatch(/Get my link/i);
  });

  it('initPaidConversionBoost marks paid landing without interstitial or sticky bar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('location', {
      search: '?utm_source=reddit&utm_medium=paid',
      pathname: '/',
    });
    captureUtmAttribution();

    const ok = initPaidConversionBoost(location as Location, window);
    expect(ok).toBe(true);
    expect(document.documentElement.getAttribute('data-vr-paid-landing')).toBe('1');
    expect(document.getElementById('mobile-referral-cta')?.classList.contains('hidden')).toBe(
      true,
    );

    vi.advanceTimersByTime(PAID_MOBILE_DWELL_MS + 50);
    vi.advanceTimersByTime(10_000);
    expect(document.getElementById('vr-paid-getlink-nudge')).toBeNull();
  });

  it('initPaidConversionBoost skips non-paid traffic', () => {
    vi.stubGlobal('location', { search: '', pathname: '/' });
    expect(initPaidConversionBoost(location as Location, window)).toBe(false);
    expect(document.documentElement.getAttribute('data-vr-paid-landing')).toBeNull();
  });
});
