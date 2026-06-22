import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadSiteContent } from '../../src/app';
import * as supabaseMod from '../../src/lib/supabase';
import { getReferralBaseUrl } from '../../src/public/globals';
import { buildReferralLinkFromBase, parseRefFromLocation } from '../../src/lib/referral-url';

function locationFromUrl(url: string): Location {
  const u = new URL(url);
  return { pathname: u.pathname, search: u.search } as Location;
}

describe('loadSiteContent (fetchSiteContent → updatePublicContent → referral base)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies referral_base_url from fetched site_content', async () => {
    vi.spyOn(supabaseMod, 'fetchSiteContent').mockResolvedValue({
      referral_base_url: 'https://mybrand.com/join',
      hero_title_line1: 'Test Hero',
    });

    document.body.innerHTML = '<h1 id="hero-title-line1"></h1>';

    await loadSiteContent();

    expect(getReferralBaseUrl()).toBe('https://mybrand.com/join');
    expect(document.getElementById('hero-title-line1')?.textContent).toBe('Test Hero');

    const link = buildReferralLinkFromBase('VIRAL-LOAD', getReferralBaseUrl());
    expect(parseRefFromLocation(locationFromUrl(link))).toBe('VIRAL-LOAD');
  });
});