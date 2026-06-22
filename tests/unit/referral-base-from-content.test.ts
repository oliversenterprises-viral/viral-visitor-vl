import { describe, expect, it, beforeEach } from 'vitest';
import { applyReferralBaseFromSiteContent } from '../../src/content';
import { getReferralBaseUrl } from '../../src/public/globals';
import { buildReferralLinkFromBase, parseRefFromLocation } from '../../src/lib/referral-url';

function locationFromUrl(url: string): Location {
  const u = new URL(url);
  return { pathname: u.pathname, search: u.search } as Location;
}

describe('applyReferralBaseFromSiteContent', () => {
  beforeEach(() => {
    applyReferralBaseFromSiteContent({});
  });

  it('sets default www base when referral_base_url missing', () => {
    applyReferralBaseFromSiteContent({});
    expect(getReferralBaseUrl()).toBe('https://www.viralrefer.app');
  });

  it('sets custom /join base from site_content', () => {
    applyReferralBaseFromSiteContent({ referral_base_url: 'https://mybrand.com/join' });
    expect(getReferralBaseUrl()).toBe('https://mybrand.com/join');
  });

  it('content → base → build → parse roundtrip for /join subpath', () => {
    applyReferralBaseFromSiteContent({ referral_base_url: 'https://mybrand.com/join' });
    const base = getReferralBaseUrl();
    const code = 'VIRAL-CONTENT-JOIN';
    const link = buildReferralLinkFromBase(code, base);
    expect(link).toBe('https://mybrand.com/join/r/VIRAL-CONTENT-JOIN');
    expect(parseRefFromLocation(locationFromUrl(link))).toBe(code);
  });
});