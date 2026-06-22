import { describe, expect, it } from 'vitest';
import {
  buildCleanReferralLink,
  buildReferralLinkFromBase,
  captureReferralAttribution,
  getStoredLandingRef,
  normalizeReferralCode,
  parseRefFromLocation,
  revealReferralAttributionBanner,
} from '../../src/lib/referral-url';

function mockLocation(pathname: string, search = '') {
  return { pathname, search } as Location;
}

describe('referral-url', () => {
  it('parses ?ref= query', () => {
    expect(parseRefFromLocation(mockLocation('/', '?ref=viral-abc123'))).toBe('VIRAL-ABC123');
  });

  it('parses /r/CODE path', () => {
    expect(parseRefFromLocation(mockLocation('/r/VIRAL-97UWEGZ'))).toBe('VIRAL-97UWEGZ');
    expect(parseRefFromLocation(mockLocation('/r/viral-97uwegz/'))).toBe('VIRAL-97UWEGZ');
  });

  it('builds clean path link', () => {
    expect(buildCleanReferralLink('VIRAL-97UWEGZ')).toBe(
      'https://www.viralrefer.app/r/VIRAL-97UWEGZ',
    );
  });

  it('buildReferralLinkFromBase preserves subpath (/join → /join/r/CODE)', () => {
    expect(buildReferralLinkFromBase('VIRAL-JOIN', 'https://mybrand.com/join')).toBe(
      'https://mybrand.com/join/r/VIRAL-JOIN',
    );
  });

  it('buildReferralLinkFromBase merges ?ref= into existing query', () => {
    expect(
      buildReferralLinkFromBase('VIRAL-QS', 'https://landing.example.com/?utm_source=x'),
    ).toBe('https://landing.example.com?utm_source=x&ref=VIRAL-QS');
  });

  it('buildReferralLinkFromBase uses clean /r/ for root base', () => {
    expect(buildReferralLinkFromBase('VIRAL-ROOT', 'https://www.viralrefer.app')).toBe(
      'https://www.viralrefer.app/r/VIRAL-ROOT',
    );
  });

  it('normalizes codes', () => {
    expect(normalizeReferralCode(' viral-x ')).toBe('VIRAL-X');
  });

  it('captureReferralAttribution stores ref in sessionStorage', () => {
    sessionStorage.clear();
    const ref = captureReferralAttribution(mockLocation('/', '?ref=VIRAL-STORED'));
    expect(ref).toBe('VIRAL-STORED');
    expect(getStoredLandingRef()).toBe('VIRAL-STORED');
  });

  it('getStoredLandingRef returns null when empty', () => {
    sessionStorage.clear();
    expect(getStoredLandingRef()).toBeNull();
  });

  it('revealReferralAttributionBanner unhides banner DOM', () => {
    document.body.innerHTML = `
      <div id="referral-attribution" class="hidden">
        <span id="referrer-code-display"></span>
      </div>`;
    revealReferralAttributionBanner(mockLocation('/r/VIRAL-BANNER'));
    const banner = document.getElementById('referral-attribution');
    expect(banner?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('referrer-code-display')?.textContent).toBe('VIRAL-BANNER');
  });
});